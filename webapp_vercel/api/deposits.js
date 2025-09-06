// API для обработки депозитов
// Vercel Serverless Function

import { query } from '../lib/db.js';

export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { user_id, amount, currency } = req.body;

      if (!user_id || !amount || !currency) {
        return res.status(400).json({ error: 'Требуются параметры user_id, amount и currency' });
      }

      if (amount < 10 || amount > 50000) {
        return res.status(400).json({ error: 'Сумма должна быть от $10 до $50,000' });
      }

      // Создаем инвойс через Crypto Bot API
      const invoice = await createCryptoInvoice(amount, currency);
      
      if (!invoice) {
        return res.status(500).json({ error: 'Ошибка создания платежа' });
      }

      // Сохраняем депозит в базе данных
      await query(`
        INSERT INTO deposits (user_id, amount, currency, invoice_id, status, created_at) 
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `, [user_id, amount, currency, invoice.invoice_id]);

      return res.status(200).json({
        invoice_id: invoice.invoice_id,
        pay_url: invoice.pay_url,
        amount: amount,
        currency: currency
      });
      
    } catch (error) {
      console.error('Ошибка создания депозита:', error);
      return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешен' });
}

// Функция для создания инвойса через Crypto Bot API
async function createCryptoInvoice(amount, currency) {
  try {
    const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;
    const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-app.vercel.app';
    
    if (!CRYPTO_BOT_TOKEN) {
      console.error('CRYPTO_BOT_TOKEN не установлен');
      return null;
    }

    const response = await fetch('https://pay.crypt.bot/api/createInvoice', {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': CRYPTO_BOT_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        asset: currency,
        amount: amount.toString(),
        description: `Пополнение баланса на ${amount} ${currency}`,
        paid_btn_name: 'callback',
        paid_btn_url: `${WEBAPP_URL}/payment_success`
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.ok) {
        return result.result;
      }
    }

    console.error('Ошибка Crypto Bot API:', await response.text());
    return null;
    
  } catch (error) {
    console.error('Ошибка создания инвойса:', error);
    return null;
  }
}