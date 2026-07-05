import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** https かつ hostname が substack.com（またはそのサブドメイン）のみ許可。 */
function isValidSubstackLink(link: string): boolean {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return host === "substack.com" || host.endsWith(".substack.com");
}

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { error: "ログインが必要です。" },
      { status: 401 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("フォームデータを読み取れませんでした。");
  }

  const image = formData.get("image");
  const title = String(formData.get("title") ?? "").trim();
  const handle = String(formData.get("handle") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  // 投稿区分: poster（ポスター）/ stall（屋台）。未指定・不正値は poster に丸める。
  const kindRaw = String(formData.get("kind") ?? "poster").trim();
  const kind = kindRaw === "stall" ? "stall" : "poster";

  // バリデーション
  if (!(image instanceof File) || image.size === 0) {
    return badRequest("画像を選択してください。");
  }
  if (!image.type.startsWith("image/")) {
    return badRequest("画像ファイル（PNG / JPG など）のみアップロードできます。");
  }
  if (image.size > MAX_IMAGE_SIZE) {
    return badRequest("画像サイズは 5MB 以下にしてください。");
  }
  if (!title) {
    return badRequest("タイトルを入力してください。");
  }
  if (!handle) {
    return badRequest("ハンドルネームを入力してください。");
  }
  if (link && !isValidSubstackLink(link)) {
    return badRequest(
      "リンクは https:// から始まる Substack（substack.com）の URL のみ掲載できます。",
    );
  }

  // Storage へアップロード（パスを DB に保存する。URL は保存しない）
  const extFromName = (image.name.split(".").pop() ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const extFromType = (image.type.split("/")[1] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const ext = extFromName || extFromType || "png";
  const imagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const fileBody = await image.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("posters")
    .upload(imagePath, fileBody, { contentType: image.type });

  if (uploadError) {
    console.error("posters upload error:", uploadError.message);
    return NextResponse.json(
      { error: "画像のアップロードに失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }

  const { error: insertError } = await supabase.from("posters").insert({
    user_id: user.id,
    kind,
    title,
    handle,
    description: description || null,
    link: link || null,
    image_path: imagePath,
    likes: 0,
  });

  if (insertError) {
    console.error("posters insert error:", insertError.message);
    // 迷子の画像を残さないように掃除（失敗しても致命的ではない）
    await supabase.storage.from("posters").remove([imagePath]);
    return NextResponse.json(
      { error: "投稿の保存に失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
