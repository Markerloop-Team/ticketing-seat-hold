from django.urls import path

from . import views

urlpatterns = [
    path("events/<slug:slug>/", views.EventDetail.as_view()),
    path("events/<slug:slug>/sections/<int:section_id>/seats/", views.SectionSeats.as_view()),
    path("events/<slug:slug>/holds/", views.HoldCreate.as_view()),
    path("holds/<uuid:token>/", views.HoldDetail.as_view()),
    path("holds/<uuid:token>/confirm/", views.HoldConfirm.as_view()),
    path("orders/<uuid:token>/", views.OrderDetail.as_view()),
]
