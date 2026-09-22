import request from 'supertest';
import { expect } from 'chai';
import 'dotenv/config';

export const adminCredentials = {
  email: process.env.ADMIN_EMAIL,
  senha: process.env.ADMIN_SENHA,
};

export const seededStudentCredentials = {
  email: process.env.ALUNO_EMAIL,
  senha: process.env.ALUNO_SENHA,
};

export const registeredStudentPassword = process.env.TEST_STUDENT_SENHA;

export async function loginAsAdmin(app, credentials = adminCredentials) {
  const response = await request(app)
    .post('/api/auth/login')
    .send(credentials);

  expect(response.status).to.equal(200);
  expect(response.body).to.have.property('token');

  return response.body.token;
}

export async function loginAsAluno(app, credentials) {
  const response = await request(app)
    .post('/api/auth/login')
    .send(credentials);

  expect(response.status).to.equal(200);
  expect(response.body).to.have.property('token');

  return response.body.token;
}
