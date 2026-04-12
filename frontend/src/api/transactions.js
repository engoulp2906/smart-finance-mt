import http from './http';

export const uploadTransactionCsv = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await http.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const fetchTransactionSummary = async () => {
  const response = await http.get('/summary');
  return response.data;
};