import os
import json
import requests
import yaml
from datetime import date
import config
from qiniu import Auth, BucketManager

def get_exif_json(domain):
    exif_url = f"https://{domain}/gallery/exif_data.json"
    response = requests.get(exif_url, timeout=30)
    response.raise_for_status()
    exif_data_dict = response.json()

    # 检查本地是否存在 exif_data.json 文件
    local_exif_file = config.exif_json_path
    local_exif_data_dict = {}

    if os.path.exists(local_exif_file):
        with open(local_exif_file, 'r', encoding='utf-8') as json_file:
            local_exif_data_dict = json.load(json_file)  # 读取本地数据

    # 更新本地数据
    for key in list(local_exif_data_dict.keys()):
        if key not in exif_data_dict:
            # 如果远程没有该键，而本地有，则删除本地的键
            del local_exif_data_dict[key]
            print(f"删除本地的键: {key}")

    for key in exif_data_dict:
        if key not in local_exif_data_dict:
            # 如果本地没有该键，则将远程的键添加到本地
            local_exif_data_dict[key] = exif_data_dict[key]
            print(f"添加远程的键: {key}")

    # 将更新后的数据写回到本地的 exif_data.json 文件
    with open(local_exif_file, 'w', encoding='utf-8') as json_file:
        json.dump(local_exif_data_dict, json_file, ensure_ascii=False, indent=4)

    print("exif_data.json 文件已更新并保存到本地。")


def update_albums_json_data(auth, bucket_name, domain, folder='gallery'):
    # 存储相册信息的字典
    albums = {}

    prefix = folder.rstrip('/') + '/'
    bucket_manager = BucketManager(auth)
    marker = None
    while True:
        ret, eof, info = bucket_manager.list(bucket_name, prefix=prefix, marker=marker)
        for item in ret.get('items', []):
            key = item.get('key', '')
            if key.endswith('.webp'):
                # 生成图片链接
                image_url = f"https://{domain}/{key}"
                # 获取相册名称（假设相册名称是文件路径的一部分）
                album_name = key.split('/')[1]
                if album_name not in albums:
                    albums[album_name] = {'images': []}
                albums[album_name]['images'].append(image_url)
            elif key.endswith('.yaml'):
                yaml_url = f"https://{domain}/{key}"
                resp = requests.get(yaml_url, timeout=30)
                resp.raise_for_status()
                album_info = yaml.safe_load(resp.text)
                album_name = key.split('/')[1]
                if album_name not in albums:
                    albums[album_name] = {'images': []}
                albums[album_name].update(album_info)
        if eof:
            break
        marker = ret.get('marker')

    # 将日期对象转换为字符串
    def convert_dates(obj):
        if isinstance(obj, dict):
            return {k: convert_dates(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_dates(i) for i in obj]
        elif isinstance(obj, date):
            return obj.isoformat()  # 转换为ISO格式的字符串
        return obj

    # 转换相册信息中的日期
    albums = convert_dates(albums)

    # 将信息保存到JSON文件中
    with open(config.albums_json_path, 'w', encoding='utf-8') as json_file:
        json.dump(albums, json_file, ensure_ascii=False, indent=4)

    print("相册信息已保存到 albums.json 文件中。")

    # 从七牛下载 exif_data.json 保存到本地
    get_exif_json(domain)



# 调用函数以更新相册数据
if __name__ == "__main__":
    from dotenv import load_dotenv

    # 加载 .env 文件中的环境变量
    load_dotenv()

    # 读取密钥
    qiniu_access_key = os.getenv('QINIU_ACCESS_KEY')
    qiniu_secret_key = os.getenv('QINIU_SECRET_KEY')
    qiniu_bucket = os.getenv('QINIU_BUCKET')
    qiniu_domain = os.getenv('QINIU_DOMAIN')

    # 七牛云配置
    auth = Auth(qiniu_access_key, qiniu_secret_key)
    update_albums_json_data(auth, qiniu_bucket, qiniu_domain)
    
    
