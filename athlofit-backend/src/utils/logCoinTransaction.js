// src/utils/logCoinTransaction.js
const CoinTransaction = require('../models/CoinTransaction.model');

/**
 * Log a coin transaction to the persistent CoinTransaction collection.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.userId - The user's ID
 * @param {string} params.type - 'EARNED' | 'SPENT' | 'REFUND'
 * @param {number} params.amount - Coin amount (always positive)
 * @param {number} params.balanceAfter - Balance after this transaction
 * @param {string} params.source - Source enum value (e.g. 'PASSIVE_STEPS')
 * @param {string} params.description - Human-readable description
 * @param {Object} [params.metadata] - Optional context metadata
 * @returns {Promise<Object>} The created transaction document
 */
async function logCoinTransaction({ userId, type, amount, balanceAfter, source, description, metadata }) {
  try {
    // Don't log zero-amount transactions
    if (!amount || amount <= 0) return null;

    const transaction = await CoinTransaction.create({
      user: userId,
      type,
      amount: parseFloat(amount.toFixed(4)),
      balanceAfter: parseFloat(balanceAfter.toFixed(4)),
      source,
      description,
      metadata: metadata || {},
    });

    return transaction;
  } catch (err) {
    // Log but don't throw — transaction logging should never break the main flow
    console.error('[logCoinTransaction] Failed to log transaction:', err.message);
    return null;
  }
}

module.exports = { logCoinTransaction };
