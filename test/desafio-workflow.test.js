import fs from 'node:fs';
import request from 'supertest';
import { expect } from 'chai';
import mongoose from 'mongoose';
import 'dotenv/config';
import app from '../src/app.js';
import Aluno from '../src/models/aluno.model.js';
import Matricula from '../src/models/matricula.model.js';
import Trabalho from '../src/models/trabalho.model.js';
import {
  adminCredentials,
  loginAsAdmin,
  loginAsAluno,
  registeredStudentPassword,
  seededStudentCredentials,
} from './helpers/auth.helpers.js';

const testData = JSON.parse(
  fs.readFileSync(new URL('./fixtures/desafio-workflow.json', import.meta.url), 'utf8')
);

describe('Desafio - workflow de autenticação e entrega de trabalho', function () {
  let alunoId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    const alunoExistente = await Aluno.findOne({ email: testData.newStudent.email });

    if (alunoExistente) {
      await Trabalho.deleteMany({ alunoId: alunoExistente.id });
      await Matricula.deleteMany({ alunoId: alunoExistente.id });
      await Aluno.findByIdAndDelete(alunoExistente.id);
    }
  });

  describe('Data-Driven Testing - login', () => {
    testData.loginScenarios.forEach(({ name, payload, expectedStatus, expectedError }) => {
      it(`deve tratar ${name}`, async () => {
        const credentialsByScenario = {
          admin: adminCredentials,
          'admin-invalid-password': {
            ...adminCredentials,
            senha: process.env.ADMIN_INVALID_SENHA,
          },
          'seeded-student': seededStudentCredentials,
        };
        const credentials = credentialsByScenario[payload];
        const response = await request(app).post('/api/auth/login').send(credentials);

        expect(response.status).to.equal(expectedStatus);

        if (expectedError) {
          expect(response.body.error).to.equal(expectedError);
          return;
        }

        expect(response.body).to.have.property('token');
      });
    });
  });

  it('deve permitir que o administrador cadastre e matricule um aluno, que entrega um trabalho', async () => {
    const adminToken = await loginAsAdmin(app);
    const newStudentCredentials = {
      email: testData.newStudent.email,
      senha: registeredStudentPassword,
    };

    const alunoResponse = await request(app)
      .post('/api/admin/alunos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...testData.newStudent, senha: registeredStudentPassword });

    expect(alunoResponse.status).to.equal(201);
    expect(alunoResponse.body).to.include({
      nome: testData.newStudent.nome,
      email: testData.newStudent.email,
      matricula: testData.newStudent.matricula,
    });
    expect(alunoResponse.body).to.have.property('id');
    expect(alunoResponse.body).to.not.have.property('senha');
    alunoId = alunoResponse.body.id;

    const matriculaResponse = await request(app)
      .post(`/api/admin/disciplinas/${testData.workSubmission.disciplinaId}/matriculas`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ alunoId });

    expect(matriculaResponse.status).to.equal(201);
    expect(matriculaResponse.body).to.include({ alunoId, disciplinaId: testData.workSubmission.disciplinaId });

    const alunoToken = await loginAsAluno(app, newStudentCredentials);
    expect(alunoToken).to.be.a('string').that.is.not.empty;

    const trabalhoResponse = await request(app)
      .post(`/api/alunos/${alunoId}/trabalhos`)
      .set('Authorization', `Bearer ${alunoToken}`)
      .send(testData.workSubmission);

    expect(trabalhoResponse.status).to.equal(201);
    expect(trabalhoResponse.body).to.include({
      alunoId,
      disciplinaId: testData.workSubmission.disciplinaId,
      titulo: testData.workSubmission.titulo,
    });
    expect(trabalhoResponse.body).to.have.property('status', 'entregue');
  });

  after(async () => {
    try {
      if (alunoId) {
        await Trabalho.deleteMany({ alunoId });
        await Matricula.deleteMany({ alunoId });
        await Aluno.findByIdAndDelete(alunoId);
      }
    } finally {
      await mongoose.connection.close();
    }
  });
});
