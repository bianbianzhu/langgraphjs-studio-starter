import {
  BaseMessage,
  HumanMessage,
  isAIMessage,
} from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { StructuredToolInterface, tool } from "@langchain/core/tools";
import {
  Annotation,
  END,
  MemorySaver,
  MessagesAnnotation,
  NodeInterrupt,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

const graphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  refundAuthorized: Annotation<boolean | undefined>,
});

type GraphState = typeof graphAnnotation.State;

const refundPurchase = tool(
  (args) => {
    return `Refund processed for order ID: ${args.order_id}`;
  },
  {
    name: "refund_purchase",
    description: "Refund a purchase for a given order ID",
    schema: z.object({
      order_id: z.string().describe("The order ID to refund"),
    }),
  }
);

const tools = [refundPurchase] satisfies Array<StructuredToolInterface>;

async function callModel(state: GraphState): Promise<Partial<GraphState>> {
  const { messages } = state;

  const chatModel = new ChatOpenAI({
    temperature: 0,
    model: "gpt-4o-mini",
  });

  const modelWithTools = chatModel.bindTools(tools);

  const response = await modelWithTools.invoke(messages);

  return { messages: [response] };
}

const toolNode = new ToolNode(tools);

async function checkAuthorizationWithDynamicInterrupt(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { refundAuthorized } = state;

  console.log("The workflow actually runs to this point");

  if (refundAuthorized !== true) {
    // THIS MUST BE INSIDE A NODE (not a condition)
    throw new NodeInterrupt("Permission to refund is required.");
  }

  return {};
}

function shouldContinue(state: GraphState): "check_authorization" | typeof END {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  if (!isAIMessage(lastMessage) || !lastMessage.tool_calls?.length) {
    return END;
  }

  return "check_authorization";
}

const stateGraph = new StateGraph(graphAnnotation);

const workflow = stateGraph
  .addNode("call_model", callModel)
  .addNode("tool_node", toolNode)
  .addNode("check_authorization", checkAuthorizationWithDynamicInterrupt)

  .addEdge(START, "call_model")
  .addConditionalEdges("call_model", shouldContinue, [
    "check_authorization",
    END,
  ])
  .addEdge("check_authorization", "tool_node")
  .addEdge("tool_node", "call_model");

const checkpointer = new MemorySaver();

export const app = workflow.compile({
  // Comment when using langgraph studio
  // checkpointer,
});

async function main() {
  const config: RunnableConfig = {
    configurable: {
      thread_id: "node-interrupt",
    },
  };

  const res1 = await app.invoke(
    {
      messages: [
        new HumanMessage(
          "Hello, I would like to refund my order. My order ID is 12345."
        ),
      ],
    },
    config
  );

  await app.updateState(config, {
    refundAuthorized: true,
  } as Partial<GraphState>);

  const res2 = await app.invoke(null, config);

  const history = app.getStateHistory(config);

  for await (const snapshot of history) {
    console.log(`========= STEP ${snapshot.metadata?.step} =========`);
    logSnapshot(snapshot);
  }
}

// Must comment when using langgraph studio
// main();

type StateSnapshot = Awaited<ReturnType<typeof app.getState>>;

export function logSnapshot(snapshot: StateSnapshot) {
  const values = snapshot.values as GraphState;

  const messages = values.messages.map((message) => {
    const msgType = message._getType();

    if (
      isAIMessage(message) &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length > 0
    ) {
      return {
        type: `${msgType.toUpperCase()} with TOOL_CALLS`,
        tool_calls: message.tool_calls.map((tc) => tc.name),
      };
    } else {
      return {
        type: msgType.toUpperCase(),
        content: message.content,
      };
    }
  });

  const writes = snapshot.metadata?.writes;

  if (writes && Object.keys(writes).length > 0) {
    for (const [key, value] of Object.entries(writes)) {
      if (key === "messages") {
        value as BaseMessage[];
      }
    }

    const sp = {
      states: {
        ...values,
        messages,
      },
      next: snapshot.next,
      writes: snapshot.metadata?.writes,
    };

    console.log(JSON.stringify(sp, null, 2));
  }
}
