// API для создания/обновления пользователей
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
      const { user_id, username, first_name, referrer_id } = req.body;

      if (!user_id || !first_name) {
        return res.status(400).json({ error: 'Требуются параметры user_id и first_name' });
      }

      // Проверяем, существует ли пользователь
      const existingUsers = await query(`
        SELECT user_id FROM users WHERE user_id = ?
      `, [user_id]);

      if (existingUsers.length > 0) {
        // Пользователь уже существует, возвращаем его данные
        const users = await query(`
          SELECT user_id, username, first_name, balance, referrer_id, 
                 total_earned, total_referred, registration_date
          FROM users WHERE user_id = ?
        `, [user_id]);
        
        return res.status(200).json(users[0]);
      }

      // Создаем нового пользователя
      await query(`
        INSERT INTO users (user_id, username, first_name, referrer_id, balance, registration_date) 
        VALUES (?, ?, ?, ?, 0.0, datetime('now'))
      `, [user_id, username, first_name, referrer_id]);

      // Начисляем приветственный бонус
      const welcomeBonus = 10.0;
      await query(`
        UPDATE users SET balance = balance + ? WHERE user_id = ?
      `, [welcomeBonus, user_id]);

      // Добавляем транзакцию приветственного бонуса
      await query(`
        INSERT INTO transactions (user_id, type, amount, description, created_at) 
        VALUES (?, 'bonus', ?, 'Приветственный бонус', datetime('now'))
      `, [user_id, welcomeBonus]);

      // Если есть реферер, начисляем ему бонус
      if (referrer_id) {
        const referrerBonus = 25.0;
        
        // Проверяем, существует ли реферер
        const referrers = await query(`
          SELECT user_id FROM users WHERE user_id = ?
        `, [referrer_id]);

        if (referrers.length > 0) {
          // Начисляем бонус рефереру
          await query(`
            UPDATE users SET balance = balance + ?, total_referred = total_referred + 1 
            WHERE user_id = ?
          `, [referrerBonus, referrer_id]);

          // Добавляем транзакцию реферального бонуса
          await query(`
            INSERT INTO transactions (user_id, type, amount, description, created_at) 
            VALUES (?, 'referral', ?, ?, datetime('now'))
          `, [referrer_id, referrerBonus, `Реферальный бонус за ${first_name}`]);
        }
      }

      // Получаем данные созданного пользователя
      const users = await query(`
        SELECT user_id, username, first_name, balance, referrer_id, 
               total_earned, total_referred, registration_date
        FROM users WHERE user_id = ?
      `, [user_id]);

      return res.status(201).json(users[0]);
      
    } catch (error) {
      console.error('Ошибка создания пользователя:', error);
      return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  return res.status(405).json({ error: 'Метод не разрешен' });
}