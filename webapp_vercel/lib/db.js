// API для обработки заявок на вывод
// Vercel Serverless Function

import { query } from '../lib/db.js';

export default async function handler(req, res) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { user_id, amount, currency, wallet_address } = req.body;

      if (!user_id || !amount || !currency || !wallet_address) {
        return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
      }

      if (amount < 20) {
        return res.status(400).json({ error: 'Минимальная сумма вывода: $20' });
      }

      // Проверяем баланс пользователя
      const users = await query(`
        SELECT balance FROM users WHERE user_id = ?
      `, [user_id]);

      if (users.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const userBalance = parseFloat(users[0].balance);
      if (amount > userBalance) {
        return res.status(400).json({ 
          error: `Недостаточно средств. Доступно: $${userBalance.toFixed(2)}` 
        });
      }

      // Создаем заявку на вывод
      const result = await query(`
        INSERT INTO withdrawals (user_id, amount, currency, wallet_address, status, created_at) 
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `, [user_id, amount, currency, wallet_address]);

      const withdrawalId = result.lastInsertRowid;

      // Замораживаем средства на балансе (вычитаем с баланса)
      await query(`
        UPDATE users SET balance = balance - ? WHERE user_id = ?
      `, [amount, user_id]);

      // Добавляем транзакцию
      await query(`
        INSERT INTO transactions (user_id, type, amount, description, created_at) 
        VALUES (?, 'withdrawal', ?, ?, datetime('now'))
      `, [user_id, -amount, `Заявка на вывод #${withdrawalId} (${currency})`]);

      // Уведомляем админа (здесь можно добавить отправку в Telegram)
      // await notifyAdmin(`Новая заявка на вывод #${withdrawalId}: $${amount} ${currency}`);

      return res.status(200).json({
        withdrawal_id: withdrawalId,
        message: 'Заявка на вывод создана успешно'
      });
      
    } catch (error) {
      console.error('Ошибка создания заявки на вывод:', error);
      return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({ error: 'Требуется параметр user_id' });
      }

      // Получаем заявки на вывод пользователя
      const withdrawals = await query(`
        SELECT id, amount, currency, wallet_address, status, created_at
        FROM withdrawals 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 20
      `, [user_id]);

      return res.status(200).json(withdrawals);
      
    } catch (error) {
      console.error('Ошибка получения заявок на вывод:', error);
      return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешен' });
}