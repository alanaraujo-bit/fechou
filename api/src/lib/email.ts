import type { FastifyBaseLogger } from "fastify";

/**
 * Envia o código OTP por e-mail via Resend (se RESEND_API_KEY estiver
 * configurada) ou registra no log do serviço (v0 — o código aparece nos
 * logs da Railway até plugarmos um provedor de e-mail).
 */
export async function enviarCodigoOtp(
  log: FastifyBaseLogger,
  email: string,
  codigo: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    log.info({ email, codigo }, "OTP gerado (envio de e-mail não configurado)");
    return;
  }

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Fechou <onboarding@resend.dev>",
      to: [email],
      subject: `${codigo} é o seu código do Fechou`,
      text: `Seu código de acesso ao Fechou é: ${codigo}\n\nEle expira em 10 minutos. Se você não pediu esse código, ignore este e-mail.`,
    }),
  });

  if (!resposta.ok) {
    // Não trava o login se o provedor recusar (ex.: Resend em modo teste):
    // o código fica nos logs e o fluxo segue.
    const corpo = await resposta.text();
    log.warn(
      { status: resposta.status, corpo, email, codigo },
      "e-mail de OTP não enviado — código disponível no log",
    );
  }
}
