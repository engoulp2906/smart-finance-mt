import http from './http';

export const uploadBillFile = async ({ userId, file }) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);

  const response = await http.post('/bills/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const fetchPendingBills = async (userId) => {
  const response = await http.get('/bills/pending', {
    params: { userId },
  });

  return response.data;
};

export const payBillById = async ({ userId, billId }) => {
  const response = await http.post('/bills/pay', {
    userId,
    billId,
  });

  return response.data;
};