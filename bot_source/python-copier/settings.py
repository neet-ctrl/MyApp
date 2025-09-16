from configparser import ConfigParser
import os
import logging

# Use environment variables set by the API or defaults
API_ID = int(os.getenv('TG_API_ID') or os.getenv('API_ID') or '1')
API_HASH = os.getenv('TG_API_HASH') or os.getenv('API_HASH') or 'default_hash'

# Session string with Railway conflict avoidance - use Railway-specific session when deployed
STRING_SESSION = os.getenv('RAILWAY_SESSION_STRING') or '1BVtsOKsBu7_Sm6oqn7q_JG49VDr6uuMQDasC2-xXy1nYvv-stWa14npRKMV4rTQU2Q7CgL5VtnJodONQmvfAzo5Oj07EImJtk3pVlVa7fP8D-IKJQ4pK3_MzlhX6PHYtYWA_GFjLwbxVI6pwb9XHJEtswyfKP0LqQrbhvkZ7YNCpoGIE9-9Sg1l0F2jTnkjTc3II0puNnLtrmyvHuOR8SlqqhCzzaX9OOBxLq2TZh46rL9WGaN2ieZy_M2k0r-7Ax1ryuax4j93mKt8ulGG6tRinvzog08cABAIJawjVDmh-Rv-sxFqgmjJ2RvqfffKidfmLu8932t0vtvJgTYW21CxfLjB3ny0='

# Path to config file - can be set by API
CONFIG_PATH = os.getenv('CONFIG_PATH', 'config.ini')

assert API_ID and API_HASH, "API_ID and API_HASH must be set"

configur = ConfigParser()
configur.read(CONFIG_PATH)

forwards = configur.sections()


def get_forward(forward: str) -> tuple:
    try:
        from_chat = configur.get(forward, 'from')
        to_chat = configur.get(forward, 'to')
        offset = configur.getint(forward, 'offset')
        return from_chat, to_chat, offset
    except Exception as err:
        logging.exception(
            'The content of %s does not follow format. See the README.md file for more details. \n\n %s', forward, str(err))
        raise err  # Don't quit, let the calling API handle the error


def update_offset(forward: str, new_offset: str) -> None:
    try:
        configur.set(forward, 'offset', new_offset)
        with open(CONFIG_PATH, 'w') as cfg:
            configur.write(cfg)
    except Exception as err:
        logging.exception(
            'Problem occured while updating offset of %s \n\n %s', forward, str(err))
        raise err  # Don't quit, let the calling API handle the error


def reload_config():
    """Reload the configuration file"""
    global configur, forwards
    configur = ConfigParser()
    configur.read(CONFIG_PATH)
    forwards = configur.sections()


if __name__ == "__main__":
    # testing
    for forward in forwards:
        print(forward, get_forward(forward))