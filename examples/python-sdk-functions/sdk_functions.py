import os

from pxxl import PxxlClient


def client() -> PxxlClient:
    return PxxlClient(api_key=os.environ["PXXL_API_KEY"])


def upload_cdn_asset(path: str):
    return client().upload_asset(file_path=path, visibility="public")


def search_domain(domain: str):
    return client().search_domains(domain)


def connect_domain(domain: str, project_id: str):
    return client().connect_domain(domain, project_id=project_id)


def create_cron_job():
    return client().create_cron_job(
        name="cache warmer",
        schedule="*/5 * * * *",
        url="https://example.com/api/warm-cache",
        method="POST",
        timeoutSeconds=10,
    )


def deploy_current_directory():
    return client().deploy(
        directory=".",
        name="python-sdk-example",
        domain_choice="pxxl.app",
        language="python",
        framework="fastapi",
        commit_message="Deploy from Python SDK",
    )


if __name__ == "__main__":
    print(client().summary())
