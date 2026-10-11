import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { getAuthorizedCashbook } from "@/server/permissions";
import { getCashbookExportData, generateCashbookPdfBuffer, generateCashbookExcelBuffer } from "@/server/export";
import { handleApiError, jsonError } from "@/server/api-utils";

type Params = { params: Promise<{ id: string }> };

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "cashbook";
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await getAuthorizedCashbook(id, user.id);

    const format = req.nextUrl.searchParams.get("format");
    if (format !== "pdf" && format !== "xlsx") {
      return jsonError('format must be "pdf" or "xlsx"', 400);
    }

    const data = await getCashbookExportData(id);
    const slug = slugify(data.cashbook.name);

    if (format === "pdf") {
      const buffer = await generateCashbookPdfBuffer(data);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${slug}-statement.pdf"`,
        },
      });
    }

    const buffer = await generateCashbookExcelBuffer(data);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${slug}-statement.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
