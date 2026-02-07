import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (!lat || !lng) {
      return NextResponse.json({ error: '缺少坐标参数' }, { status: 400 });
    }

    const key = process.env.GAODE_KEY || process.env.AMAP_KEY;
    if (!key) {
      return NextResponse.json({ error: '未配置高德 Key' }, { status: 500 });
    }

    const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(
      key
    )}&location=${encodeURIComponent(`${lng},${lat}`)}&extensions=base&radius=1000`;

    const resp = await fetch(url);
    if (!resp.ok) {
      return NextResponse.json({ error: `高德接口失败: ${resp.status}` }, { status: 502 });
    }
    const data = await resp.json();
    if (data?.status !== '1') {
      return NextResponse.json({ error: data?.info || '高德返回失败' }, { status: 200 });
    }
    const formatted = data?.regeocode?.formatted_address || '';
    if (formatted) {
      return NextResponse.json({ address: formatted });
    }
    const comp = data?.regeocode?.addressComponent || {};
    const parts = [
      comp.province,
      comp.city && comp.city !== comp.province ? comp.city : '',
      comp.district,
      comp.township,
      comp.streetNumber?.street,
      comp.streetNumber?.number,
    ].filter(Boolean);
    const address = parts.join('');
    if (!address) {
      return NextResponse.json({ error: '未解析到地址' }, { status: 200 });
    }
    return NextResponse.json({ address });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '解析失败' },
      { status: 500 }
    );
  }
}
