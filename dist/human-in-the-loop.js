"use strict";
// define the state
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const messages_1 = require("@langchain/core/messages");
const prompts_1 = require("@langchain/core/prompts");
const tools_1 = require("@langchain/core/tools");
const langgraph_1 = require("@langchain/langgraph");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const openai_1 = require("@langchain/openai");
const zod_1 = __importDefault(require("zod"));
var AuthorizationState;
(function (AuthorizationState) {
    AuthorizationState["Authorized"] = "authorized";
    AuthorizationState["Unauthorized"] = "unauthorized";
    AuthorizationState["Authorizing"] = "authorizing";
})(AuthorizationState || (AuthorizationState = {}));
var GraphNode;
(function (GraphNode) {
    GraphNode["CallModel"] = "call_model";
    GraphNode["ReadOnlyToolNode"] = "read_only_tool_node";
    GraphNode["RequestAuthorization"] = "request_authorization";
    GraphNode["AuthorizedToolNode"] = "authorized_tool_node";
})(GraphNode || (GraphNode = {}));
const graphAnnotation = langgraph_1.Annotation.Root({
    ...langgraph_1.MessagesAnnotation.spec,
    authorizationState: (langgraph_1.Annotation),
    generatedCode: (langgraph_1.Annotation),
    providedCode: (langgraph_1.Annotation),
});
const systemTemplate = `You are Emily. An human export (not an AI assistant!) of customer support for Officeworks Inc.,an Australian-based retail chain that specializes in office supplies, technology products, furniture, and educational resources. They cater to businesses, schools, and individuals, offering a wide range of products such as stationery, office furniture, computers, printers, software, and technology accessories.

In addition to retail sales, Officeworks provides services like print and copy services, business card printing, laminating, and binding. They also offer tech support, installation services, and delivery for both consumers and businesses. Their product range and services are designed to support workplaces, home offices, and students alike.

You can chat with customers and help them with basic questions, but you do not know anything innately about billing or technical issues.
Instead, you should use the data sources or tools available to resolve the user's problem in a satisfactory way.`;
const promptTemplate = prompts_1.ChatPromptTemplate.fromMessages([
    ["system", systemTemplate],
    ["placeholder", "{messages}"],
]);
const technicalSupportManual = (0, tools_1.tool)((args) => {
    return `The issue: ${args.problem} that you are experiencing with the product: ${args.product} is a common issue. You should try restarting the device.`;
}, {
    name: "technical_support_manual",
    description: "Answers technical questions about Officeworks products and services.",
    schema: zod_1.default.object({
        problem: zod_1.default.string().describe("The issue the user is experiencing."),
        product: zod_1.default.string().describe("The product the user is inquiring about."),
    }),
});
const orderLookup = (0, tools_1.tool)((args) => {
    return `The order with ID ${args.order_id} is currently being processed. The estimated delivery date is ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toDateString()}.`;
}, {
    name: "order_lookup",
    description: "Looks up the status of an order.",
    schema: zod_1.default.object({
        order_id: zod_1.default.string().describe("The order ID to look up."),
        customer_name: zod_1.default.string().describe("The name of the customer."),
    }),
});
const refundPurchase = (0, tools_1.tool)((args) => {
    return `The refund for order ID ${args.order_id} has been initiated. The refund amount will be credited to the original payment method within 3-5 business days.`;
}, {
    name: "refund_purchase",
    description: "Initiates a refund for a purchase. Should be only called after collecting sufficient information from the user.",
    schema: zod_1.default.object({
        order_id: zod_1.default.string().describe("The order ID to refund."),
        customer_name: zod_1.default
            .string()
            .describe("The name of the customer who wants a refund."),
    }),
});
const READONLY_TOOLS = [
    technicalSupportManual,
    orderLookup,
];
const AUTHORIZED_TOOLS = [refundPurchase];
const allTools = [
    ...READONLY_TOOLS,
    ...AUTHORIZED_TOOLS,
];
const READONLY_TOOLS_BY_NAME = new Map(READONLY_TOOLS.map((tool) => [tool.name, tool]));
const AUTHORIZED_TOOLS_BY_NAME = new Map(AUTHORIZED_TOOLS.map((tool) => [tool.name, tool]));
async function callModel(state) {
    const { messages } = state;
    const chatModel = new openai_1.ChatOpenAI({
        temperature: 0.2,
        model: "gpt-4o-mini",
    });
    const modelWithTools = chatModel.bindTools(allTools);
    const chain = promptTemplate.pipe(modelWithTools);
    const response = await chain.invoke({ messages });
    return { messages: [response] };
}
// const toolNode = new ToolNode(allTools);
function toolRoute(state) {
    const { messages } = state;
    const lastMessage = messages.at(-1);
    if (lastMessage === undefined ||
        !(0, messages_1.isAIMessage)(lastMessage) ||
        !lastMessage.tool_calls ||
        lastMessage.tool_calls.length <= 0) {
        return langgraph_1.END;
    }
    const toolCall = lastMessage.tool_calls[0];
    if (READONLY_TOOLS_BY_NAME.get(toolCall.name) !== undefined) {
        return GraphNode.ReadOnlyToolNode;
    }
    else if (AUTHORIZED_TOOLS_BY_NAME.get(toolCall.name) !== undefined) {
        return GraphNode.RequestAuthorization;
    }
    else {
        throw new Error(`Unknown tool name: ${toolCall.name}`);
    }
}
const readOnlyToolNode = new prebuilt_1.ToolNode(READONLY_TOOLS);
const authorizedToolNode = new prebuilt_1.ToolNode(AUTHORIZED_TOOLS);
async function requestAuthorization(state) {
    return {};
}
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
const stateGraph = new langgraph_1.StateGraph(graphAnnotation);
const workflow = stateGraph
    .addNode(GraphNode.CallModel, callModel)
    .addNode(GraphNode.ReadOnlyToolNode, readOnlyToolNode)
    .addNode(GraphNode.RequestAuthorization, requestAuthorization)
    .addNode(GraphNode.AuthorizedToolNode, authorizedToolNode)
    .addEdge(langgraph_1.START, GraphNode.CallModel)
    .addConditionalEdges(GraphNode.CallModel, toolRoute, [
    GraphNode.ReadOnlyToolNode,
    GraphNode.RequestAuthorization,
    langgraph_1.END,
])
    .addEdge(GraphNode.ReadOnlyToolNode, GraphNode.CallModel)
    .addEdge(GraphNode.RequestAuthorization, GraphNode.AuthorizedToolNode)
    .addEdge(GraphNode.AuthorizedToolNode, GraphNode.CallModel);
exports.app = workflow.compile({});
//# sourceMappingURL=human-in-the-loop.js.map