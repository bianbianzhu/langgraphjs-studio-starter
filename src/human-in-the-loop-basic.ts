import { HumanMessage, isAIMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
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

const chatModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const processRefundTool = tool(
  (args) => {
    return `Refund processed for order ID: ${args.orderId}`;
  },
  {
    name: "process_refund",
    description: "Process a refund for a given order ID",
    schema: z.object({
      orderId: z.string().describe("The order ID to process a refund for"),
    }),
  }
);

const tools = [processRefundTool];

async function callModel(state: GraphState): Promise<Partial<GraphState>> {
  const { messages } = state;

  const modelWithTools = chatModel.bindTools(tools);

  const response = await modelWithTools.invoke(messages);

  return { messages: [response] };
}

const toolNode = new ToolNode(tools);

async function checkAuthorization(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { refundAuthorized } = state;

  if (refundAuthorized !== true) {
    throw new Error("Refund not authorized.");
  }

  return {};
}

// Cannot use prebuilt `toolConditions` as it goes to `tools` node or END
function toolsConditionWithAuthorization(
  state: GraphState
): "check_authorization" | typeof END {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  if (!isAIMessage(lastMessage) || !lastMessage.tool_calls?.length) {
    return END;
  }

  return "check_authorization";
}

// The following is the logic of the toolNode under the hood:
// async function callTool(state: GraphState): Promise<Partial<GraphState>> {
//   const { messages } = state;
//   const lastMessage = messages[messages.length - 1];

//   if (!isAIMessage(lastMessage) || !lastMessage.tool_calls?.length) {
//     throw new Error("No tools were called.");
//   }

//   const toolCall = lastMessage.tool_calls[0];

//   const toolMessage = await processRefundTool.invoke(toolCall);

//   return { messages: [toolMessage] };
// }

const stateGraph = new StateGraph(graphAnnotation);

const checkpointer = new MemorySaver();

// Correct way 1:
// export const app = workflow
//   .addNode("call_model", callModel)
//   .addNode("tools", toolNode)

//   .addEdge(START, "call_model")
//   .addConditionalEdges("call_model", toolsCondition, ["tools", END])
//   .addEdge("tools", "call_model")

//   .compile({
//     //   checkpointer,
//     interruptBefore: ["tools"],
//   });

// Correct way 2:
const workflow = stateGraph
  .addNode("call_model", callModel)
  .addNode("check_authorization", checkAuthorization)
  .addNode("tools", toolNode)

  .addEdge(START, "call_model")
  .addConditionalEdges("call_model", toolsConditionWithAuthorization, [
    "check_authorization",
    END,
  ])
  .addEdge("check_authorization", "tools")
  .addEdge("tools", "call_model");

export const app = workflow.compile({
  // checkpointer,
  interruptBefore: ["check_authorization"], // this can be replaced by dynamic interrupt
});

// Incorrect way:
// stateGraph
//   .addNode("call_model", callModel)
//   .addNode("tools", toolNode)

//   .addEdge(START, "call_model")
//   .addConditionalEdges("call_model", toolsCondition, ["tools", END])
//   .addEdge("tools", "call_model");

// export const app = stateGraph.compile({
//   interruptBefore: ["tools"], // Type '"tools"' is not assignable to type '"__start__"'.
// });

async function main() {
  console.log("============================");
  const config: RunnableConfig = {
    configurable: {
      thread_id: "refunder",
    },
  };

  const res1 = await app.stream(
    {
      messages: [new HumanMessage("I want to have a refund for order ID 1234")],
    },
    {
      ...config,
      streamMode: "updates" as const, // why as const?
    }
  );

  for await (const event of res1) {
    const key = Object.keys(event)[0];
    if (key) {
      console.log(`Event: ${key}\n`);
    }
  }

  console.log("===== Interrupting before check_authorization =====");

  console.log(
    "---refundAuthorized value before state update---",
    (await app.getState(config)).values.refundAuthorized
  );

  await app.updateState(config, { refundAuthorized: true });

  console.log(
    "---refundAuthorized value after state update---",
    (await app.getState(config)).values.refundAuthorized
  );

  console.log("===== Resuming after state update =====");
  const res2 = await app.stream(null, {
    ...config,
    streamMode: "updates" as const,
  });

  for await (const event of res2) {
    logEvent(event);
  }
}

// Must comment when using langgraph studio
// main();

export function logEvent(event: Record<string, any>) {
  const key = Object.keys(event)[0];
  if (key) {
    console.log(`Event: ${key}`);
    if (Array.isArray(event[key].messages)) {
      const lastMsg = event[key].messages[event[key].messages.length - 1];
      console.log(
        {
          role: lastMsg._getType(),
          content: lastMsg.content,
        },
        "\n"
      );
    } else {
      console.log(
        {
          role: event[key].messages._getType(),
          content: event[key].messages.content,
        },
        "\n"
      );
    }
  }
}
