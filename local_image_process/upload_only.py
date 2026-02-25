"""
只上传已处理的图片到七牛云，不重新处理
"""
import os
from dotenv import load_dotenv
from upload_oss import upload_folder_to_qiniu, send_webhook

load_dotenv()

if __name__ == '__main__':
    print('开始上传到七牛云...')
    upload_folder_to_qiniu(
        src_folder=os.path.join(os.path.dirname(__file__), 'output'),
        bucket_name=os.getenv('QINIU_BUCKET'),
        access_key=os.getenv('QINIU_ACCESS_KEY'),
        secret_key=os.getenv('QINIU_SECRET_KEY'),
        domain=os.getenv('QINIU_DOMAIN'),
        prefix='gallery/',
        full_upload=False,
    )
    print('上传完成！')

    print('触发webhook更新前端...')
    send_webhook()
    print('完成！')
