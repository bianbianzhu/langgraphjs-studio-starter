import { type BaseMessage } from "@langchain/core/messages";
export declare const graph: import("@langchain/langgraph").CompiledStateGraph<import("@langchain/langgraph").StateType<{
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
}>, import("@langchain/langgraph").UpdateType<{
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
}>, "tools" | "__start__" | "callModel", {
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
}, {
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
}>;
