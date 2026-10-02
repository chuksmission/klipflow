import { NextRequest, NextResponse } from "next/server";
import { getTaskStatus } from "../../lib/task-status";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");
    const provider = searchParams.get("provider") ?? "kie";

    if (!task_id) {
      return NextResponse.json({ error: "task_id is required" }, { status: 400 });
    }

    const { httpStatus, ...result } = await getTaskStatus(task_id, provider);
    return NextResponse.json(result, httpStatus ? { status: httpStatus } : undefined);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("Status check error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
