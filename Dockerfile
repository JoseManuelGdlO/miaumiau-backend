# Usar la imagen oficial de MySQL
FROM mysql:8.0

# Establecer variables de entorno para MySQL
ENV MYSQL_ROOT_PASSWORD=rootpassword
ENV MYSQL_DATABASE=miaumiau_db
ENV MYSQL_USER=miaumiau_user
ENV MYSQL_PASSWORD=miaumiau_password

# Crear directorio para scripts de inicialización
RUN mkdir -p /docker-entrypoint-initdb.d

# Copiar scripts de inicialización si los tienes
# COPY ./init-scripts/ /docker-entrypoint-initdb.d/

# Exponer el puerto 3306
EXPOSE 3306

# Comando por defecto para iniciar MySQL
CMD ["mysqld"]
