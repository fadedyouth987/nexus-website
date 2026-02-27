import { config } from 'dotenv';
config({ path: './.env' });
import { signup } from '../nexus-app/src/auth/actions';

async function testSignup() {
  const formData = new FormData();
  formData.append('email', 'test@example.com');
  formData.append('password', 'password123');

  const result = await signup({ error: null }, formData);
  console.log(result);
}

testSignup();
