"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graph = void 0;
const tavily_search_1 = require("@langchain/community/tools/tavily_search");
const openai_1 = require("@langchain/openai");
const langgraph_1 = require("@langchain/langgraph");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
// When running the graph in the langgraph studio, you don't need to have the following environment variables:
// - LANGCHAIN_API_KEY
// - LANGCHAIN_TRACING_V2=true
// - LANGCHAIN_CALLBACKS_BACKGROUND=true
// ONLY NEED:
// - OPENAI_API_KEY (if you are using OpenAI)
// - TAVILY_API_KEY (if you are using Tavily)
// ...
const tools = [new tavily_search_1.TavilySearchResults({ maxResults: 3 })];
// The nature of MessagesAnnotation:
// const MessagesAnnotation = Annotation.Root({
//   messages: Annotation<BaseMessage[]>({
//     default: () => [new SystemMessage("Hello! How can I help you today?")],
//     reducer: messagesStateReducer,
//   }),
// });
// Define the function that calls the model
async function callModel(state) {
    /**
     * Call the LLM powering our agent.
     * Feel free to customize the prompt, model, and other logic!
     */
    const model = new openai_1.ChatOpenAI({
        model: "gpt-4o",
    }).bindTools(tools);
    const response = await model.invoke([
        {
            role: "system",
            content: `You are a helpful assistant. The current date is ${new Date().getTime()}.`,
        },
        ...state.messages,
    ]);
    // MessagesAnnotation supports returning a single message or array of messages
    return { messages: response };
}
// Define the function that determines whether to continue or not
function routeModelOutput(state) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];
    // If the LLM is invoking tools, route there.
    if ((lastMessage?.tool_calls?.length ?? 0) > 0) {
        return "tools";
    }
    // Otherwise end the graph.
    return "__end__";
}
// Define a new graph.
// See https://langchain-ai.github.io/langgraphjs/how-tos/define-state/#getting-started for
// more on defining custom graph states.
const workflow = new langgraph_1.StateGraph(langgraph_1.MessagesAnnotation)
    // Define the two nodes we will cycle between
    .addNode("callModel", callModel)
    .addNode("tools", new prebuilt_1.ToolNode(tools))
    // Set the entrypoint as `callModel`
    // This means that this node is the first one called
    .addEdge("__start__", "callModel")
    .addConditionalEdges(
// First, we define the edges' source node. We use `callModel`.
// This means these are the edges taken after the `callModel` node is called.
"callModel", 
// Next, we pass in the function that will determine the sink node(s), which
// will be called after the source node is called.
routeModelOutput, 
// List of the possible destinations the conditional edge can route to.
// Required for conditional edges to properly render the graph in Studio
["tools", "__end__"])
    // This means that after `tools` is called, `callModel` node is called next.
    .addEdge("tools", "callModel");
// Finally, we compile it!
// This compiles it into a graph you can invoke and deploy.
exports.graph = workflow.compile({
// if you want to update the state before calling the tools
// interruptBefore: [],
// ================
// The Langgraph Studio/Cloud API will automatically add a checkpointer
// only need to provide the checkpointer if running locally
// checkpointer: new MemorySaver()
});
//# sourceMappingURL=agent.js.map