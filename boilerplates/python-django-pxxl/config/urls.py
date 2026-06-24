from django.http import JsonResponse
from django.urls import path


def index(_request):
    return JsonResponse({"ok": True, "service": "Django on Pxxl"})


urlpatterns = [path("", index)]
