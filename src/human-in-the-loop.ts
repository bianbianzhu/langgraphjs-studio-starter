// define the state

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  isAIMessage,
} from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableConfig } from "@langchain/core/runnables";
import { StructuredTool, tool } from "@langchain/core/tools";
import {
  Annotation,
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { traceable } from "langsmith/traceable";
import callTwilio from "twilio";
import z from "zod";

enum AuthorizationState {
  Idle = "idle",
  Authorized = "authorized",
  Unauthorized = "unauthorized",
  Authorizing = "authorizing",
}

enum GraphNode {
  CallModel = "call_model",
  ReadOnlyToolNode = "read_only_tool_node",
  RequestAuthorization = "request_authorization",
  AuthorizedToolNode = "authorized_tool_node",
  ConfirmAuthorization = "confirm_authorization",
  ResetAuthorization = "reset_authorization",
}

const graphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  authorizationState: Annotation<AuthorizationState>({
    default: () => AuthorizationState.Idle,
    reducer: (x, y?: AuthorizationState) => (y ? y : x),
  }),
  generatedCode: Annotation<string | undefined>,
  providedCode: Annotation<string | undefined>,
  authorizationFailedAttemptCount: Annotation<number>({
    default: () => 0,
    reducer: (x, y?: number) => (y !== undefined ? y : x),
  }),
});

type GraphState = typeof graphAnnotation.State;

const systemTemplate: string = `You are Emily. An human export (not an AI assistant!) of customer support for Officeworks Inc.,an Australian-based retail chain that specializes in office supplies, technology products, furniture, and educational resources. They cater to businesses, schools, and individuals, offering a wide range of products such as stationery, office furniture, computers, printers, software, and technology accessories.

In addition to retail sales, Officeworks provides services like print and copy services, business card printing, laminating, and binding. They also offer tech support, installation services, and delivery for both consumers and businesses. Their product range and services are designed to support workplaces, home offices, and students alike.

You can chat with customers and help them with basic questions, but you do not know anything innately about billing or technical issues.
Instead, you should use the data sources or tools available to resolve the user's problem in a satisfactory way.`;

const promptTemplate = ChatPromptTemplate.fromMessages<{
  messages: BaseMessage[];
}>([
  ["system", systemTemplate],
  ["placeholder", "{messages}"],
]);

const technicalSupportManual = tool(
  (args) => {
    return `The issue: ${args.problem} that you are experiencing with the product: ${args.product} is a common issue. You should try restarting the device.`;
  },
  {
    name: "technical_support_manual",
    description:
      "Answers technical questions about Officeworks products and services.",
    schema: z.object({
      problem: z.string().describe("The issue the user is experiencing."),
      product: z.string().describe("The product the user is inquiring about."),
    }),
  }
);

const orderLookup = tool(
  (args) => {
    return `The order with ID ${
      args.order_id
    } is currently being processed. The estimated delivery date is ${new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000
    ).toDateString()}.`;
  },
  {
    name: "order_lookup",
    description: "Looks up the status of an order.",
    schema: z.object({
      order_id: z.string().describe("The order ID to look up."),
      customer_name: z.string().describe("The name of the customer."),
    }),
  }
);

const refundPurchase = tool(
  (args) => {
    return `The refund for order ID ${args.order_id} has been initiated. The refund amount will be credited to the original payment method within 3-5 business days.`;
  },
  {
    name: "refund_purchase",
    description:
      "Initiates a refund for a purchase. Should be only called after collecting sufficient information from the user.",
    schema: z.object({
      order_id: z.string().describe("The order ID to refund."),
      customer_name: z
        .string()
        .describe("The name of the customer who wants a refund."),
    }),
  }
);

const READONLY_TOOLS = [
  technicalSupportManual,
  orderLookup,
] satisfies StructuredTool[];

const AUTHORIZED_TOOLS = [refundPurchase] satisfies StructuredTool[];

const allTools = [
  ...READONLY_TOOLS,
  ...AUTHORIZED_TOOLS,
] satisfies StructuredTool[];

const READONLY_TOOLS_BY_NAME = new Map(
  READONLY_TOOLS.map((tool) => [tool.name, tool])
);

const AUTHORIZED_TOOLS_BY_NAME = new Map(
  AUTHORIZED_TOOLS.map((tool) => [tool.name, tool])
);

async function callModel(state: GraphState): Promise<Partial<GraphState>> {
  const { messages } = state;
  const chatModel = new ChatOpenAI({
    temperature: 0.2,
    model: "gpt-4o-mini",
  });

  const modelWithTools = chatModel.bindTools(allTools);
  const chain = promptTemplate.pipe(modelWithTools);
  const response = await chain.invoke({ messages });

  return { messages: [response] };
}

// const toolNode = new ToolNode(allTools);

function toolRoute(
  state: GraphState
): GraphNode.RequestAuthorization | GraphNode.ReadOnlyToolNode | typeof END {
  const { messages } = state;
  const lastMessage = messages.at(-1);
  if (
    lastMessage === undefined ||
    !isAIMessage(lastMessage) ||
    !Array.isArray(lastMessage.tool_calls) ||
    lastMessage.tool_calls.length <= 0
  ) {
    return END;
  }

  const toolCall = lastMessage.tool_calls[0];
  if (READONLY_TOOLS_BY_NAME.get(toolCall.name) !== undefined) {
    return GraphNode.ReadOnlyToolNode;
  } else if (AUTHORIZED_TOOLS_BY_NAME.get(toolCall.name) !== undefined) {
    return GraphNode.RequestAuthorization;
  } else {
    throw new Error(`Unknown tool name: ${toolCall.name}`);
  }
}

const readOnlyToolNode = new ToolNode(READONLY_TOOLS);

const authorizedToolNode = new ToolNode(AUTHORIZED_TOOLS);

async function requestAuthorization(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { authorizationState } = state;

  if (authorizationState === AuthorizationState.Idle) {
    const generatedCode = generateRandomSixDigitCode();

    // const sendSMS = traceable(callTwilio, {
    //   name: "Twilio SMS",
    //   run_type: "tool",
    // });

    // try {
    //   await sendSMS(generatedCode, process.env);
    // } catch (err) {
    //   console.error(err);
    // }

    return {
      authorizationState: AuthorizationState.Authorizing,
      generatedCode,
      //   messages: [
      //     new AIMessage(
      //       `A 6-digit code has been sent to your phone. Please provide the code to authorize the refund process.`
      //     ),
      //   ], // This makes the last message not be the tool call, and ToolNode after this will fail
    };
  } else {
    return {
      authorizationState: AuthorizationState.Authorizing,
    };
  }
}

function generateRandomSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function confirmAuthorization(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { generatedCode, providedCode, authorizationFailedAttemptCount } =
    state;

  const isAuthorized = generatedCode === providedCode;

  return isAuthorized
    ? {
        authorizationState: AuthorizationState.Authorized,
        generatedCode: undefined,
        providedCode: undefined,
        // messages: [
        //   new AIMessage(
        //     `You have been successfully authorized to process the refund.`
        //   ),
        // ], // This makes the last message not be the tool call, and ToolNode after this will fail
      }
    : {
        authorizationState: AuthorizationState.Unauthorized,
        providedCode: undefined,
        authorizationFailedAttemptCount: authorizationFailedAttemptCount + 1,
        // messages: [
        //   new AIMessage(
        //     `The code you provided is incorrect. Please try again.`
        //   ),
        // ], // This makes the last message not be the tool call, and ToolNode after this will fail
      };
}

function shouldExecuteAuthorizedTool(
  state: GraphState
): GraphNode.AuthorizedToolNode | GraphNode.RequestAuthorization {
  const { authorizationState } = state;
  if (authorizationState === AuthorizationState.Authorized) {
    return GraphNode.AuthorizedToolNode;
  } else {
    return GraphNode.RequestAuthorization;
  }
}

async function resetAuthorization(
  _state: GraphState
): Promise<Partial<GraphState>> {
  return {
    authorizationState: AuthorizationState.Idle,
    generatedCode: undefined,
    providedCode: undefined,
    authorizationFailedAttemptCount: 0,
  };
}

// The following can be replaced by the prebuilt `toolsCondition`
// function shouldContinue(state: GraphState): GraphNode.ToolNode | typeof END {
//   const { messages } = state;
//   const lastMessage = messages.at(-1);
//   if (
//     lastMessage !== undefined &&
//     isAIMessage(lastMessage) &&
//     lastMessage.tool_calls &&
//     lastMessage.tool_calls.length > 0
//   ) {
//     return GraphNode.ToolNode;
//   }

//   return END;
// }

const stateGraph = new StateGraph(graphAnnotation);

const workflow = stateGraph
  .addNode(GraphNode.CallModel, callModel)
  .addNode(GraphNode.ReadOnlyToolNode, readOnlyToolNode)
  .addNode(GraphNode.RequestAuthorization, requestAuthorization)
  .addNode(GraphNode.ConfirmAuthorization, confirmAuthorization)
  .addNode(GraphNode.AuthorizedToolNode, authorizedToolNode)
  .addNode(GraphNode.ResetAuthorization, resetAuthorization)

  .addEdge(START, GraphNode.CallModel)
  .addConditionalEdges(GraphNode.CallModel, toolRoute, [
    GraphNode.ReadOnlyToolNode,
    GraphNode.RequestAuthorization,
    END,
  ])
  .addEdge(GraphNode.ReadOnlyToolNode, GraphNode.CallModel)
  .addEdge(GraphNode.RequestAuthorization, GraphNode.ConfirmAuthorization)
  .addConditionalEdges(
    GraphNode.ConfirmAuthorization,
    shouldExecuteAuthorizedTool,
    [GraphNode.AuthorizedToolNode, GraphNode.RequestAuthorization]
  )
  .addEdge(GraphNode.AuthorizedToolNode, GraphNode.ResetAuthorization)
  .addEdge(GraphNode.ResetAuthorization, GraphNode.CallModel);

const checkpointer = new MemorySaver();

export const app = workflow.compile({
  //   checkpointer,
  interruptBefore: [GraphNode.ConfirmAuthorization],
});

async function main() {
  const config: RunnableConfig = {
    configurable: {
      thread_id: "1234",
    },
  };

  const response = await app.invoke(
    {
      messages: [new HumanMessage("I want a refund")],
    },
    config
  );

  const response2 = await app.invoke(
    {
      messages: [new HumanMessage("my name is John Doe, order id is 123")],
    },
    config
  );

  let two_factor_code = null;

  if (two_factor_code !== null) {
    app.updateState(config, { providedCode: two_factor_code });

    const response3 = await app.invoke(null, config);
  }

  const history = app.getStateHistory(config);

  for await (const snapshot of history) {
    console.log(`======== Step ${snapshot.metadata?.step} ========`);
    console.log(JSON.stringify(snapshot, null, 2));
  }
}

// Must comment when using langgraph studio
// main();
