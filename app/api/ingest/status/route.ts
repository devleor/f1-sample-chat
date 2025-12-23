import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const STATUS_FILE = path.join(os.tmpdir(), "f1chat_ingest_status.json");

export async function GET() {
    try {
        if (!fs.existsSync(STATUS_FILE)) {
            return NextResponse.json({ status: "idle" });
        }
        const data = fs.readFileSync(STATUS_FILE, "utf-8");
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        return NextResponse.json({ status: "error", message: "Failed to read status" });
    }
}
