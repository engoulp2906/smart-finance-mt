import http from './http';

const DEMO_USER_ID = 'demo-user';

export const fetchDemoWalletBalance = async () => {
  const response = await http.get('/wallet/balance', {
    params: { userId: DEMO_USER_ID },
  });

  return response.data;
};

export const payDemoBill = async ({ billName, amount }) => {
  const response = await http.post('/demo/pay-bill', {
    billName,
    amount,
  });

  return response.data;
};