import handler from '../api/admin.js';

const req = {
  method: 'POST',
  headers: {
    authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  },
  body: {
    action: 'list_users'
  }
};

const res = {
  setHeader: () => {},
  status: (code) => {
    return {
      json: (data) => {
        console.log('Status:', code, data);
      }
    };
  }
};

handler(req, res).catch(console.error);
