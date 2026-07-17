import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET ?? "fechou-fotos";

if (!accountId || !accessKeyId || !secretAccessKey) {
  throw new Error("Credenciais do R2 não configuradas (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const CONTENT_TYPES_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const UPLOAD_VALIDADE_SEG = 10 * 60;
const LEITURA_VALIDADE_SEG = 24 * 60 * 60;

/** Gera URL assinada pro app subir a foto direto pro R2 (a API não trafega os bytes). */
export async function criarUrlUploadFoto(contentType: string) {
  if (!CONTENT_TYPES_PERMITIDOS.has(contentType)) {
    throw new Error("Tipo de imagem não suportado (use JPEG, PNG ou WebP)");
  }

  const extensao = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `anuncios/${randomUUID()}.${extensao}`;

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_VALIDADE_SEG },
  );

  return { key, uploadUrl, validadeSegundos: UPLOAD_VALIDADE_SEG };
}

/** URL assinada de leitura — o bucket é privado; o feed recebe URLs temporárias. */
export async function criarUrlLeituraFoto(key: string): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: LEITURA_VALIDADE_SEG,
  });
}
