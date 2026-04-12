import http from './http';

export const fetchWalletBalance = async (userId) => {
  const response = await http.get('/wallet/balance', {
    params: { userId },
  });

  return response.data;
};

export const addWalletFunds = async ({ userId, amount }) => {
  const response = await http.post('/wallet/add-funds', {
    userId,
    amount,
  });

  return response.data;
};