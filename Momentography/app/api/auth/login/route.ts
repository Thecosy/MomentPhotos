import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const { username, password } = await request.json();

  // 调用后端 Python API 进行验证
  const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8089';

  try {
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      // 创建一个新的响应对象，并在响应中设置cookie
      const result = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });

      // 设置cookie
      result.headers.append('Set-Cookie', `admin-auth=true; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24}; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`);

      return result;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
      });
    }
  } catch (error) {
    console.error('Backend auth error:', error);
    return new Response(JSON.stringify({ error: 'Authentication service unavailable' }), {
      status: 503,
    });
  }
} 
