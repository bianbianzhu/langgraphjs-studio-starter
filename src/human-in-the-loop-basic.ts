import { isAIMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
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
  interruptBefore: ["check_authorization"],
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
