from django.apps import AppConfig


class DonationsConfig(AppConfig):
    name = 'donations'

    def ready(self):
        try:
            import donations.tasks  # noqa
        except ImportError:
            pass

