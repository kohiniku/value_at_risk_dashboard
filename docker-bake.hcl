variable "IMAGE_REGISTRY" {
  default = ""
}

variable "BACKEND_IMAGE" {
  default = "value-at-risk-backend"
}

variable "BACKEND_TAG" {
  default = "latest"
}

variable "FRONTEND_IMAGE" {
  default = "value-at-risk-frontend"
}

variable "FRONTEND_TAG" {
  default = "latest"
}

variable "NEXT_PUBLIC_API_BASE_URL" {
  default = "/api/v1"
}

variable "NEXT_PUBLIC_NEWS_LIMIT" {
  default = "5"
}

group "default" {
  targets = ["backend", "frontend"]
}

target "backend" {
  context    = "./backend"
  dockerfile = "Dockerfile"
  tags       = ["${IMAGE_REGISTRY}${BACKEND_IMAGE}:${BACKEND_TAG}"]
}

target "frontend" {
  context    = "./frontend"
  dockerfile = "Dockerfile"
  tags       = ["${IMAGE_REGISTRY}${FRONTEND_IMAGE}:${FRONTEND_TAG}"]

  args = {
    NEXT_PUBLIC_API_BASE_URL = "${NEXT_PUBLIC_API_BASE_URL}"
    NEXT_PUBLIC_NEWS_LIMIT   = "${NEXT_PUBLIC_NEWS_LIMIT}"
  }
}
