import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Envio de e-mail abstraído atrás de uma única função — nenhum provedor
 * SMTP está configurado em produção ainda, então enviar() só registra o
 * e-mail no log (nível info) e retorna, sem lançar erro: as funcionalidades
 * que dependem de e-mail (redefinição de senha, notificações) continuam
 * funcionando no resto do fluxo, só sem o envio de fato até SMTP_HOST (e os
 * demais SMTP_*) serem configurados nas variáveis de ambiente — nenhuma
 * outra mudança de código é necessária quando isso acontecer.
 */
export const mailer = {
  async enviar(email: Email): Promise<void> {
    if (!env.SMTP_HOST) {
      logger.info({ to: email.to, subject: email.subject }, "[mailer] SMTP não configurado — e-mail não enviado, apenas registrado no log");
      return;
    }
    const transporte = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    await transporte.sendMail({
      from: env.MAIL_FROM || env.SMTP_USER,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  },
};
