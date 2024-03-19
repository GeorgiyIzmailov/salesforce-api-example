import { NextRequest, NextResponse } from "next/server";
import {
  InvalidRequest,
  CreateCaseRequestBodySchema,
} from "./requestSchemaValidation";
import { createSupportCase } from "./createSupportCase";

const originHeaders = {
  "Access-Control-Allow-Origin": "*", // set specific to your clients
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS(req: NextRequest) {
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

    const response = await createSupportCase(body);

    if (response.status !== 201) {
      throw response;
    }

    return new NextResponse(null, {
      status: 200,
      statusText: "OK",
      headers: originHeaders,
    });
  } catch (error) {
    console.error(error);
    return new NextResponse(null, {
      status: 500,
      statusText: "Internal Server Error",
      headers: originHeaders,
    });
  }
}
