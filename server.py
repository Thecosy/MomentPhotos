import os
import subprocess

from qiniu import Auth
from flask import Flask, request, jsonify
from dotenv import load_dotenv

from read_oss import update_albums_json_data

# 在应用启动时加载环境变量
load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)

    def import_json_to_db():
        repo_root = os.path.dirname(os.path.abspath(__file__))
        momentography_dir = os.path.join(repo_root, "Momentography")
        script_path = os.path.join(momentography_dir, "scripts", "import-json-to-db.js")
        if not os.path.exists(script_path):
            raise FileNotFoundError(f"missing import script: {script_path}")

        result = subprocess.run(
            ["node", script_path],
            cwd=momentography_dir,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return result.stdout, result.stderr

    # 当 OSS 更新时，更新相册数据和 EXIF 数据到本地 JSON 文件
    @app.route("/webhook", methods=["POST"])
    def webhook():
        print("收到 webhook 请求，开始更新相册和 EXIF 数据。")

        # 加载 .env 文件中的环境变量
        load_dotenv()

        # 读取密钥
        qiniu_access_key = os.getenv("QINIU_ACCESS_KEY")
        qiniu_secret_key = os.getenv("QINIU_SECRET_KEY")
        qiniu_bucket = os.getenv("QINIU_BUCKET")
        qiniu_domain = os.getenv("QINIU_DOMAIN")

        if not all([qiniu_access_key, qiniu_secret_key, qiniu_bucket, qiniu_domain]):
            return "Missing Qiniu config", 500

        # 七牛云配置
        auth = Auth(qiniu_access_key, qiniu_secret_key)
        update_albums_json_data(auth, qiniu_bucket, qiniu_domain)  # albums.json & exif_data.json

        try:
            stdout, stderr = import_json_to_db()
            if stdout:
                print(stdout)
            if stderr:
                print(stderr)
        except Exception as exc:
            print(f"导入数据库失败: {exc}")
            return "Webhook received, but DB import failed", 500

        return "Webhook received and DB updated", 200

    @app.route("/healthz", methods=["GET"])
    def healthz():
        return "ok", 200

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        """登录验证接口"""
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        expected_username = os.getenv("ADMIN_USERNAME", "admin")
        expected_password = os.getenv("ADMIN_PASSWORD", "admin123")

        print(f"Login attempt - username: '{username}', expected: '{expected_username}'")
        print(f"Password received: '{password}', expected: '{expected_password}'")
        print(f"Username match: {username == expected_username}, Password match: {password == expected_password}")

        if username == expected_username and password == expected_password:
            return jsonify({"success": True}), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8089"))
    app.run(host="0.0.0.0", port=port)
