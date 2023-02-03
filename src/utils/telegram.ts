import axios from "axios";

export interface SendTelegramMessagePayload {
  chatId: string;
  text: string;
  botToken: string;
}

export class TelegramHelpers {
  static async sendMessage(payload: SendTelegramMessagePayload) {
    await axios.post(
      `https://api.telegram.org/bot${payload.botToken}/sendMessage`,
      {
        chat_id: payload.chatId,
        text: payload.text,
        parse_mode: "HTML",
      }
    );
  }

  static async getChatIdMessages(botToken: string, chat_id: string): Promise<string[]> {
    const result = await axios.get(
      `https://api.telegram.org/bot${botToken}/getupdates`
    );
    const messages = result.data.result;
    return messages.filter((message: any) => {
      if (message?.channel_post?.sender_chat?.id?.toString() === chat_id) {
        return true;
      }
      return false;
    })
  }
}
