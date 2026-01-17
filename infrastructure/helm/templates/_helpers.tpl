{{/*
Expand the name of the chart.
*/}}
{{- define "opsimate.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "opsimate.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "opsimate.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "opsimate.labels" -}}
helm.sh/chart: {{ include "opsimate.chart" . }}
{{ include "opsimate.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "opsimate.selectorLabels" -}}
app.kubernetes.io/name: {{ include "opsimate.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "opsimate.backend.labels" -}}
{{ include "opsimate.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "opsimate.backend.selectorLabels" -}}
{{ include "opsimate.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Worker labels
*/}}
{{- define "opsimate.worker.labels" -}}
{{ include "opsimate.labels" . }}
app.kubernetes.io/component: worker
{{- end }}

{{/*
Worker selector labels
*/}}
{{- define "opsimate.worker.selectorLabels" -}}
{{ include "opsimate.selectorLabels" . }}
app.kubernetes.io/component: worker
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "opsimate.frontend.labels" -}}
{{ include "opsimate.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "opsimate.frontend.selectorLabels" -}}
{{ include "opsimate.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "opsimate.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "opsimate.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Secret name
*/}}
{{- define "opsimate.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- include "opsimate.fullname" . }}-secret
{{- end }}
{{- end }}

{{/*
ConfigMap name
*/}}
{{- define "opsimate.configMapName" -}}
{{- include "opsimate.fullname" . }}-config
{{- end }}

{{/*
Backend service name
*/}}
{{- define "opsimate.backend.serviceName" -}}
{{- include "opsimate.fullname" . }}-backend
{{- end }}

{{/*
Frontend service name
*/}}
{{- define "opsimate.frontend.serviceName" -}}
{{- include "opsimate.fullname" . }}-frontend
{{- end }}

{{/*
Data PVC name
*/}}
{{- define "opsimate.pvc.data" -}}
{{- include "opsimate.fullname" . }}-data
{{- end }}
