c = open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', encoding='utf-8').read()
# Check that </div> closes the flex wrapper after </main>
main_close_pos = c.rfind('</main>')
print(c[main_close_pos:main_close_pos+200])
