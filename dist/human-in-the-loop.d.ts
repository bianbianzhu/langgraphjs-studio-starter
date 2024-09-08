import { BaseMessage } from "@langchain/core/messages";
declare enum AuthorizationState {
    Authorized = "authorized",
    Unauthorized = "unauthorized",
    Authorizing = "authorizing"
}
declare enum GraphNode {
    CallModel = "call_model",
    ReadOnlyToolNode = "read_only_tool_node",
    RequestAuthorization = "request_authorization",
    AuthorizedToolNode = "authorized_tool_node"
}
export declare const app: import("@langchain/langgraph").CompiledStateGraph<import("@langchain/langgraph").StateType<{
    authorizationState: {
        (): import("@langchain/langgraph").LastValue<AuthorizationState | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<AuthorizationState | undefined, AuthorizationState | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<AuthorizationState | undefined, AuthorizationState | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    generatedCode: {
        (): import("@langchain/langgraph").LastValue<string | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<string | undefined, string | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<string | undefined, string | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    providedCode: {
        (): import("@langchain/langgraph").LastValue<string | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<string | undefined, string | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<string | undefined, string | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
}>, import("@langchain/langgraph").UpdateType<{
    authorizationState: {
        (): import("@langchain/langgraph").LastValue<AuthorizationState | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<AuthorizationState | undefined, AuthorizationState | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<AuthorizationState | undefined, AuthorizationState | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    generatedCode: {
        (): import("@langchain/langgraph").LastValue<string | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<string | undefined, string | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<string | undefined, string | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    providedCode: {
        (): import("@langchain/langgraph").LastValue<string | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<string | undefined, string | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<string | undefined, string | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
}>, "__start__" | GraphNode, {
    authorizationState: {
        (): import("@langchain/langgraph").LastValue<AuthorizationState | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<AuthorizationState | undefined, AuthorizationState | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<AuthorizationState | undefined, AuthorizationState | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    generatedCode: {
        (): import("@langchain/langgraph").LastValue<string | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<string | undefined, string | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<string | undefined, string | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    providedCode: {
        (): import("@langchain/langgraph").LastValue<string | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<string | undefined, string | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<string | undefined, string | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
}, {
    authorizationState: {
        (): import("@langchain/langgraph").LastValue<AuthorizationState | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<AuthorizationState | undefined, AuthorizationState | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<AuthorizationState | undefined, AuthorizationState | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    generatedCode: {
        (): import("@langchain/langgraph").LastValue<string | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<string | undefined, string | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<string | undefined, string | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    providedCode: {
        (): import("@langchain/langgraph").LastValue<string | undefined>;
        (annotation: import("@langchain/langgraph").SingleReducer<string | undefined, string | undefined>): import("@langchain/langgraph").BinaryOperatorAggregate<string | undefined, string | undefined>;
        Root: <S extends import("@langchain/langgraph").StateDefinition>(sd: S) => import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<S>;
    };
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], import("@langchain/langgraph").Messages>;
}>;
export {};
