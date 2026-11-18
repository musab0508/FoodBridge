import os
from celery import Celery
from django.conf import settings

# Set default Django settings module for celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'foodbridge.settings')

app = Celery('foodbridge')

# Read config from Django settings with namespace 'CELERY'
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover task modules in all registered Django apps (e.g. donations.tasks)
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Celery Debug Request: {self.request!r}')

