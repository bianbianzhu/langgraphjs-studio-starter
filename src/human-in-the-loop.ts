// define the state

import { BaseMessage, isAIMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tool } from "@langchain/core/tools";
import {
  Annotation,
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

enum AuthorizationState {
  Authorized = "authorized",
  Unauthorized = "unauthorized",
  Authorizing = "authorizing",
}

enum GraphNode {
  CallModel = "call_model",
  ToolNode = "tools",
}

const graphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  authorizationState: Annotation<AuthorizationState | undefined>,
  generatedCode: Annotation<string | undefined>,
  providedCode: Annotation<string | undefined>,
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

const tools = [technicalSupportManual, orderLookup, refundPurchase];

async function callModel(state: GraphState): Promise<Partial<GraphState>> {
  const { messages } = state;
  const chatModel = new ChatOpenAI({
    temperature: 0.2,
    model: "gpt-4o-mini",
  });

  const modelWithTools = chatModel.bindTools(tools);
  const chain = promptTemplate.pipe(modelWithTools);
  const response = await chain.invoke({ messages });

  return { messages: [response] };
}

const toolNode = new ToolNode(tools);

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
  .addNode(GraphNode.ToolNode, toolNode)

  .addEdge(START, GraphNode.CallModel)
  .addConditionalEdges(GraphNode.CallModel, toolsCondition, [
    GraphNode.ToolNode,
    END,
  ])
  .addEdge(GraphNode.ToolNode, GraphNode.CallModel);

export const app = workflow.compile({
  interruptBefore: [GraphNode.ToolNode],
});
