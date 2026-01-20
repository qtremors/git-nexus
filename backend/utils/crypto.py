import os
import logging
from pathlib import Path

from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load .env file (from project root)
load_dotenv(Path(__file__).parent.parent.parent / ".env")

logger = logging.getLogger("gitnexus.crypto")

# Path to the secret key file (relative to backend directory) - LEGACY fallback
KEY_FILE = Path(__file__).parent.parent / "data" / "secret.key"

# Environment variable name for the Fernet key
ENV_KEY_NAME = "FERNET_KEY"


def _load_or_generate_key() -> bytes:
    """
    Load the encryption key with priority:
    1. Environment variable (FERNET_KEY) - RECOMMENDED for security
    2. File-based key (data/secret.key) - Legacy fallback
    3. Generate new key and save to file - First-run only
    """
    # Priority 1: Environment variable (most secure)
    env_key = os.environ.get(ENV_KEY_NAME)
    if env_key:
        try:
            key_bytes = env_key.encode()
            # Validate it's a valid Fernet key
            Fernet(key_bytes)
            logger.info("Using encryption key from environment variable")
            return key_bytes
        except Exception as e:
            logger.warning(f"Invalid FERNET_KEY in environment: {e}. Falling back to file.")
    
    # Priority 2: File-based key (legacy)
    if KEY_FILE.exists():
        logger.debug("Using encryption key from file (consider migrating to env var)")
        return KEY_FILE.read_bytes()
    
    # Priority 3: Generate new key (first run)
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key()
    KEY_FILE.write_bytes(key)
    logger.warning(
        f"Generated new encryption key. For security, add to .env:\n"
        f"  {ENV_KEY_NAME}={key.decode()}\n"
        f"Then delete {KEY_FILE}"
    )
    return key


class CryptoManager:
    """Manages encryption and decryption operations."""

    def __init__(self) -> None:
        self._key = _load_or_generate_key()
        self._fernet = Fernet(self._key)

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a string.
        """
        if not plaintext:
            return ""
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt a string.
        """
        if not ciphertext:
            return ""
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except Exception:
            # Decryption failed (key changed or data corrupted)
            return ""


# Singleton instance
crypto_manager = CryptoManager()
