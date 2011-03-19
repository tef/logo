"""$Id$"""
import os
import base64
import uuid
import hashlib
import datetime 
import logging
import diff_match_patch

from google.appengine.ext.webapp import template
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext import db
from google.appengine.api import images
from google.appengine.api import memcache
from google.appengine.api import channel

class LogoProgram(db.Model):
    code = db.TextProperty()
    img  = db.BlobProperty()
    date = db.DateTimeProperty(auto_now_add=True)
    connections = db.StringListProperty()

class Papert(webapp.RequestHandler):
    def get_program(self, prog_id):
        program = memcache.get("program: %s" % prog_id)
        if program is None:
            key = db.Key.from_path('LogoProgram', self.request.path[1:])
            program = LogoProgram.get(key)
            if program is None:
                memcache.set("program: %s" % prog_id, "not found")
            else:
                memcache.set("program: %s" % prog_id, program)
        return program


    def get(self):
        prog_id = self.request.path[1:]
        program = None

        if prog_id:
            program = self.get_program(prog_id)

            if program == "not found":
                program = None

            if program is None:
                self.redirect('/')


        if program:
            values = {}
            values['code'] = program.code.replace("\n", '<br/>')
            #client id for the appengine channel
            client_id = str(uuid.uuid4())
            program.connections.append(client_id)
            program.put()
            memcache.set("program: %s" % prog_id, program)
            token = channel.create_channel(client_id)
            values['token'] = token
            values['client_id'] = client_id
            page = os.path.join(os.path.dirname(__file__), 'index.html.tmpl')
            self.response.out.write(template.render(page, values))
        else:
            prog_id=base64.b64encode(uuid.uuid4().bytes, "-_")[:-2]
            LogoProgram(key_name=prog_id, code="").put()
            self.redirect("/%s" % prog_id)


    def post(self):
        prog_id = self.request.path[1:]
        program = self.get_program(prog_id)
        dmp = diff_match_patch.diff_match_patch()
        if (program):
          patches = self.request.get('patches')
          if (patches):
            #apply patch
            program.code = dmp.patch_apply(dmp.patch_fromText(patches), program.code)[0]
            program.put()
            logging.info("Code is: %s" % program.code)
            memcache.set("program: %s" % prog_id, program)
            
            own_client_id = self.request.get('client_id')
            logging.info("Own id: %s" % own_client_id)
            logging.info("Sending patches...")
            for client_id in program.connections:
              if own_client_id != client_id:
                logging.info("Sending patch to: %s" % client_id)
                channel.send_message(client_id, patches)
    
application = webapp.WSGIApplication([('/.*', Papert)],debug=True)

def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()
