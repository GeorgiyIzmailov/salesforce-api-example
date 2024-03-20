import { NextRequest, NextResponse } from "next/server";
import {
  InvalidRequest,
  CreateCaseRequestBodySchema,
} from "./requestSchemaValidation";
import { createSupportCase } from "./createSupportCase";
import { get } from "@vercel/edge-config";

export const runtime = "edge";

const SALESFORCE_TOKEN_KEY = "salesforce_access_token";

// Set access token in Vercel Edge Config using Vercel API
const setAccessTokenInEdgeConfig = async (accessToken: string) => {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const vercelApiToken = process.env.VER_API_ACCESS_TOKEN;
  const vercelTeamId = process.env.VER_TEAM_ID;

  if (!edgeConfigId || !vercelApiToken) {
    throw new Error("Vercel Edge Config ID or Vercel API Token not found");
  }

  const exists = await get<string>(SALESFORCE_TOKEN_KEY);

  const response = await fetch(
    `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items?teamId=${vercelTeamId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${vercelApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            operation: exists ? "update" : "create",
            key: SALESFORCE_TOKEN_KEY,
            value: accessToken,
          },
        ],
      }),
    }
  );

  const responseData = await response.json();

  if (response.status !== 200 || responseData.status !== "ok") {
    throw new Error(
      `Failed to write Salesforce access token to Vercel Edge Config: ${
        response.statusText
      } - ${JSON.stringify(responseData)}`
    );
  }
};

// Get access token using client credentials and store it in Vercel Edge Config
const getNewClientCredentialsToken = async (): Promise<string> => {
  try {
    const client_id = process.env.SALESFORCE_CONSUMER_KEY;
    const client_secret = process.env.SALESFORCE_CONSUMER_SECRET;
    const username = process.env.SALESFORCE_USER_NAME;
    const password =
      `${process.env.SALESFORCE_PASSWORD}` +
      `${process.env.SALESFORCE_SECURITY_TOKEN}`;

    if (!client_id || !client_secret || !username) {
      throw new Error("Client ID, Client Secret or User Name not found");
    }

    const response = await fetch(
      "https://login.salesforce.com/services/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "password",
          client_id,
          client_secret,
          username,
          password,
        }).toString(),
      }
    );

    const responseData = await response.json();

    if (response.status !== 200) {
      throw new Error(
        `Failed to obtain access token: ${response.statusText} - ${responseData}`
      );
    }

    setAccessTokenInEdgeConfig(responseData.access_token);

    return responseData.access_token;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// get access token - gets from Vercel Edge Config cache or gets a new one from Salesforce
const getAccessToken = async () => {
  try {
    let accessToken = await get<string>(SALESFORCE_TOKEN_KEY);

    if (!accessToken) {
      accessToken = await getNewClientCredentialsToken();
    }

    return accessToken;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const originHeaders = {
  "Access-Control-Allow-Origin": "*", // set specific to your clients
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: originHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const validatedBody = CreateCaseRequestBodySchema.safeParse(
      await req.json()
    );

    if (!validatedBody.success) {
      throw new InvalidRequest(
        "Request schema invalid: " + JSON.stringify(validatedBody.error)
      );
    }

    const body = validatedBody.data;

    const accessToken = await getAccessToken();

    // try creating case
    let response = await createSupportCase(body, accessToken);

    // if token is expired
    if (response.status == 401) {
      await getNewClientCredentialsToken();
      response = await createSupportCase(body, accessToken);
    }

    // throw unsuccessful requests
    if (response.status !== 201) {
      throw response;
    }

    // Return success response
    return new NextResponse(null, {
      status: 200,
      statusText: "OK",
      headers: originHeaders,
    });
  } catch (error) {
    // Check if user validation error
    if (error instanceof InvalidRequest) {
      return new NextResponse(
        JSON.stringify({
          error: {
            type: "InvalidRequest",
            message: error.message,
          },
        }),
        {
          status: 400,
          statusText: "Bad Request",
          headers: {
            "Content-Type": "application/json",
            ...originHeaders,
          },
        }
      );
    } else {
      console.error(error);
      return new NextResponse(null, {
        status: 500,
        statusText: "Internal Server Error",
        headers: originHeaders,
      });
    }
  }
}
