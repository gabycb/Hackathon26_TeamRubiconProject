"""
OpsPlan configuration — loads from environment variables / .env file.
"""
import os
from pathlib import Path
from dataclasses import dataclass, field
from dotenv import load_dotenv

# Load .env from config directory
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)


@dataclass
class AzureOpenAIConfig:
    endpoint: str = ""
    api_key: str = ""
    deployment_name: str = "gpt-4o"
    api_version: str = "2024-06-01"

    def __post_init__(self):
        self.endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", self.endpoint)
        self.api_key = os.getenv("AZURE_OPENAI_API_KEY", self.api_key)
        self.deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT", self.deployment_name)
        self.api_version = os.getenv("AZURE_OPENAI_API_VERSION", self.api_version)


@dataclass
class AzureBlobConfig:
    connection_string: str = ""
    container_name: str = "opsplan-data"

    def __post_init__(self):
        self.connection_string = os.getenv("AZURE_BLOB_CONNECTION_STRING", self.connection_string)
        self.container_name = os.getenv("AZURE_BLOB_CONTAINER", self.container_name)


@dataclass
class AzureVisionConfig:
    endpoint: str = ""
    api_key: str = ""

    def __post_init__(self):
        self.endpoint = os.getenv("AZURE_VISION_ENDPOINT", self.endpoint)
        self.api_key = os.getenv("AZURE_VISION_API_KEY", self.api_key)


@dataclass
class AzureCommConfig:
    connection_string: str = ""
    sender_email: str = "alerts@opsplan.io"
    sender_phone: str = ""
    eventgrid_topic_key: str = ""
    sms_webhook_secret: str = ""

    def __post_init__(self):
        self.connection_string = os.getenv("AZURE_COMM_CONNECTION_STRING", self.connection_string)
        self.sender_email = os.getenv("AZURE_COMM_SENDER_EMAIL", self.sender_email)
        self.sender_phone = os.getenv("AZURE_COMM_SENDER_PHONE", self.sender_phone)
        self.eventgrid_topic_key = os.getenv("ACS_EVENTGRID_TOPIC_KEY", self.eventgrid_topic_key)
        self.sms_webhook_secret = os.getenv("ACS_SMS_WEBHOOK_SECRET", self.sms_webhook_secret)


@dataclass
class GraphConfig:
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    mailbox_user_id: str = ""
    notification_client_state: str = ""
    subscription_callback_url: str = ""

    def __post_init__(self):
        self.tenant_id = os.getenv("GRAPH_TENANT_ID", self.tenant_id)
        self.client_id = os.getenv("GRAPH_CLIENT_ID", self.client_id)
        self.client_secret = os.getenv("GRAPH_CLIENT_SECRET", self.client_secret)
        self.mailbox_user_id = os.getenv("GRAPH_MAILBOX_USER_ID", self.mailbox_user_id)
        self.notification_client_state = os.getenv("GRAPH_NOTIFICATION_CLIENT_STATE", self.notification_client_state)
        self.subscription_callback_url = os.getenv("GRAPH_SUBSCRIPTION_CALLBACK_URL", self.subscription_callback_url)


@dataclass
class CensusConfig:
    api_key: str = ""
    base_url: str = "https://api.census.gov/data"
    acs_year: int = 2022
    acs_dataset: str = "acs/acs5"

    def __post_init__(self):
        self.api_key = os.getenv("CENSUS_API_KEY", self.api_key)


@dataclass
class DatabaseConfig:
    path: str = ""

    def __post_init__(self):
        default = str(Path(__file__).parent.parent / "data" / "opsplan.db")
        self.path = os.getenv("DATABASE_PATH", default)


@dataclass
class Settings:
    """Main settings container — instantiate once at app startup."""
    azure_openai: AzureOpenAIConfig = field(default_factory=AzureOpenAIConfig)
    azure_blob: AzureBlobConfig = field(default_factory=AzureBlobConfig)
    azure_vision: AzureVisionConfig = field(default_factory=AzureVisionConfig)
    azure_comm: AzureCommConfig = field(default_factory=AzureCommConfig)
    graph: GraphConfig = field(default_factory=GraphConfig)
    census: CensusConfig = field(default_factory=CensusConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)

    # App settings
    log_level: str = "INFO"
    debug: bool = False
    inbound_auto_parse: bool = False

    def __post_init__(self):
        self.log_level = os.getenv("LOG_LEVEL", self.log_level)
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        self.inbound_auto_parse = os.getenv("INBOUND_AUTO_PARSE", "false").lower() == "true"

    def validate(self) -> list[str]:
        """Check for missing required configuration. Returns list of issues."""
        issues = []
        if not self.azure_openai.endpoint:
            issues.append("AZURE_OPENAI_ENDPOINT is required")
        if not self.azure_openai.api_key:
            issues.append("AZURE_OPENAI_API_KEY is required")
        if not self.census.api_key:
            issues.append("CENSUS_API_KEY is required (free: https://api.census.gov/data/key_signup.html)")
        return issues


# Singleton
settings = Settings()
