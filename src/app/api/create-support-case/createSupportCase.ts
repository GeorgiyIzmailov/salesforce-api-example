import {
  CreateCaseRequestBody,
  InvalidRequest,
  Message,
} from "./requestSchemaValidation";

const salesforce_domain = process.env.SALESFORCE_DOMAIN;

function formatItem(label: string, content: string | undefined | null): string {
  return content
    ? `
      ${label}:
      ${content} \n
    `
    : "";
}

function formatChatHistory(messages: Message[] | undefined | null): string {
  if (!messages) return "";

  let formattedHistory = "Chat History \n";

  messages.forEach((message) => {
    // Determine if the message is from User or AI Assistant
    if (message.role === "user") {
      formattedHistory += "Question: \n";
    } else {
      formattedHistory += "Answer: \n";
    }

    // Strip footnotes [^1] from the message content
    const cleanContent = message.content
      ? message.content.replace(/\[\^(\d+)\]/g, "")
      : "";
    formattedHistory += `${cleanContent} \n`;
  });

  return formattedHistory;
}

export async function createSupportCase(
  body: CreateCaseRequestBody,
  accessToken: string
) {
  const { formDetails, chatSession, client } = body;

  if (!salesforce_domain) throw new Error("SALESFORCE_DOMAIN is undefined");

  const hasInitialMessage = chatSession && chatSession.messages.length > 0;
  const subject = hasInitialMessage
    ? chatSession?.messages[0].content
    : formDetails.additionalDetails;

  if (!subject)
    throw new InvalidRequest(
      "Please provide at least one user message or additional details"
    );
  const inkeepViewChatUrl =
    chatSession?.chatSessionId && process.env.INKEEP_CHAT_PREVIEW_ROOT
      ? `${process.env.INKEEP_CHAT_PREVIEW_ROOT}?chatId=${chatSession.chatSessionId}`
      : null;

  const data = {
    Subject: subject,
    Description: "Description this case",
    Status: "New",
    Priority: "Medium",
    SuppliedEmail: formDetails.email,
    SuppliedName: formDetails.firstName,
    Type: "Question",
    Comments: `${formatItem(
      "Additional details",
      formDetails.additionalDetails
    )}
    ${formatChatHistory(chatSession?.messages)}

    Note: ${formatItem("Inkeep Chat URL", inkeepViewChatUrl)} ${formatItem(
      "Client (Interaction Point)",
      client.currentUrl
    )}
    `,
  };

  const res = await fetch(
    `https://${salesforce_domain}.my.salesforce.com/services/data/v60.0/sobjects/Case`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`, // Include Basic Auth header
      },
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) throw res;

  return res;
}
