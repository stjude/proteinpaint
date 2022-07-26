ARG IMGVER=latest

FROM ppfull:$IMGVER AS ppimg

############################
# Proteinpaint server image 
############################

# use the ppbase image which does NOT have 
# the Xvfb-related libs and NPM devDependencies installed 
FROM ppbase:$IMGVER as ppserver
COPY --from=ppimg /home/root/pp/app /home/root/pp/app

WORKDIR /home/root/pp/app
# delete the public folder as the build user, instead of assuming that the 
# container user is always root and can delete the public folder
RUN npm prune && rm -rf node_modules/@stjude/proteinpaint/public && chown www-data /home/root/pp/cache
COPY ./LICENSE ./
ENV PP_MODE container-prod
ENV PP_CUSTOMER gdc
# CMD [ "sleep", "3600"]
CMD [ "sh", "-c", "PP_MODE=container-prod npx proteinpaint"]
