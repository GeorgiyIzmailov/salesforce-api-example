import { z } from "zod";

export class InvalidRequest extends Error {
  type: string;

  constructor(message: string) {
    super(message); // Pass the message to the Error constructor
    this.name = "InvalidRequest"; // Set the error name to the class name
    this.type = "InvalidRequest"; // Set the type or any other custom property
  }
}

export const FormDetailsSchema = z
  .object({
    email: z.string().email(),
    firstName: z.string().min(1).nullish(),
    additionalDetails: z.string(),
  })
  .passthrough();

export type FormDetails = z.infer<typeof FormDetailsSchema>;

export const UserMessageSchema = z
  .object({
    role: z.literal("user"),
    content: z.string().nullish(),
  })
  .passthrough();
export type UserMessage = z.infer<typeof UserMessageSchema>;

export const AssistantMessageSchema = z
  .object({
    role: z.literal("assistant"),
    content: z.string().nullish(),
  })
  .passthrough();
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;

export const BaseMessageSchema = z
  .object({
    role: z.string(),
    content: z.string().nullish(),
  })
  .passthrough();
export type BaseMessage = z.infer<typeof BaseMessageSchema>;

export const MessageSchema = z.union([
  UserMessageSchema,
  AssistantMessageSchema,
  BaseMessageSchema,
]);
export type Message = z.infer<typeof MessageSchema>;

export const ChatSessionSchema = z
  .object({
    messages: z.array(MessageSchema),
    chatSessionId: z.string().nullish(),
  })
  .passthrough();
export type ChatSession = z.infer<typeof ChatSessionSchema>;

export const ClientSchema = z
  .object({
    currentUrl: z.string().nullish(),
  })
  .passthrough();
export type Client = z.infer<typeof ClientSchema>;

export const CreateCaseRequestBodySchema = z
  .object({
    formDetails: FormDetailsSchema,
    chatSession: ChatSessionSchema.nullish(),
    client: ClientSchema,
  })
  .passthrough();
export type CreateCaseRequestBody = z.infer<typeof CreateCaseRequestBodySchema>;
