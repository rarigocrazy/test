// API для получения данных пользователя
// Vercel Serverless Function

import { query } from '../../lib/db.js';

export default async function handler(req, res) {
  const { id } = req.query;
  
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      // Получаем пользователя из базы данных
      const users = await query(`
        SELECT user_id, username, first_name, balance, referrer_id, 
               total_earned, total_referred, registration_date
        FROM users WHERE user_id = ?
      `, [id]);

      if (users.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const user = users[0];
      return res.status(200).json(user);
      
    } catch (error) {
      console.error('Ошибка получения пользователя:', error);
      return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { amount, type, description } = req.body;

      if (!amount || !type) {
        return res.status(400).json({ error: 'Требуются параметры amount и type' });
      }

      // Обновляем баланс
      await query(`
        UPDATE users SET balance = balance + ? WHERE user_id = ?
      `, [amount, id]);

      // Добавляем транзакцию
      await query(`
        INSERT INTO transactions (user_id, type, amount, description) 
        VALUES (?, ?, ?, ?)
      `, [id, type, amount, description || '']);

      // Получаем обновленные данные пользователя
      const users = await query(`
        SELECT user_id, username, first_name, balance, referrer_id, 
               total_earned, total_referred, registration_date
        FROM users WHERE user_id = ?
      `, [id]);

      return res.status(200).json(users[0]);
      
    } catch (error) {
      console.error('Ошибка обновления баланса:', error);
      return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешен' });
}