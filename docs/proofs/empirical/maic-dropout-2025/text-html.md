# Page text dump

Source: https://arxiv.org/html/2508.17310

![Screenshot](screenshot-html.png)

```
Back to arXiv

This is experimental HTML to improve accessibility. We invite you to report rendering errors. 
Use Alt+Y to toggle on accessible reporting links and Alt+Shift+Y to toggle off.
Learn more about this project and help improve conversions.

Why HTML?
Report Issue
Back to Abstract
Download PDF
 Abstract
1Introduction
2Related Works
3MAIC Dropout Analysis
4MAIC Dropout Prediction
5MAIC Dropout Intervention
6Conclusion
7Limitations
8Ethical Considerations
 References

HTML conversions sometimes display errors due to content that did not convert correctly from the source. This paper uses the following packages that are not yet supported by the HTML conversion tool. Feedback on these issues are not necessary; they are known and are being worked on.

failed: inconsolata.sty

Authors: achieve the best HTML results from your LaTeX submissions by following these best practices.

License: CC BY 4.0
arXiv:2508.17310v1 [cs.CL] 24 Aug 2025
Handling Students Dropouts in an LLM-driven Interactive Online Course Using Language Models
Yuanchun Wang♠1, Yiyang Fu♠1, Jifan Yu♣, Daniel Zhang-Li♢, Zheyuan Zhang♡,
Joy Lim Jia Yin♢, Yucheng Wang♢, Peng Zhou♢, Jing Zhang♠, Huiqin Liu♣
♠School of Information, Renmin University of China      
♣Institute of Education, Tsinghua University      
♢Department of Computer Science and Technology, Tsinghua University      
♡Language Technology Institute, Carnegie Mellon University
Abstract

Interactive online learning environments, represented by Massive AI-empowered Courses (MAIC), leverage LLM-driven multi-agent systems to transform passive MOOCs into dynamic, text-based platforms, enhancing interactivity through LLMs. This paper conducts an empirical study on a specific MAIC course to explore three research questions about dropouts in these interactive online courses: (1) What factors might lead to dropouts? (2) Can we predict dropouts? (3) Can we reduce dropouts? We analyze interaction logs to define dropouts and identify contributing factors. Our findings reveal strong links between dropout behaviors and textual interaction patterns. We then propose a course-progress-adaptive dropout prediction framework (CPADP) to predict dropouts with at most 95.4% accuracy. Based on this, we design a personalized email recall agent to re-engage at-risk students.

Applied in the deployed MAIC system with over 3,000 students, the feasibility and effectiveness of our approach have been validated on students with diverse backgrounds.

Handling Students Dropouts in an LLM-driven
Interactive Online Course Using Language Models




Yuanchun Wang♠†, Yiyang Fu♠1, Jifan Yu♣, Daniel Zhang-Li♢, Zheyuan Zhang♡,
Joy Lim Jia Yin♢, Yucheng Wang♢, Peng Zhou♢, Jing Zhang♠, Huiqin Liu♣
♠School of Information, Renmin University of China
♣Institute of Education, Tsinghua University
♢Department of Computer Science and Technology, Tsinghua University
♡Language Technology Institute, Carnegie Mellon University



1Introduction

Massive Open Online Courses (MOOCs) have become a widely adopted form of online education Anders (2015). In a typical MOOC setting, learners primarily acquire knowledge by watching prerecorded instructional videos online Baturay (2015).

Figure 1:Dropouts in traditional courses (top), MOOC (middle), and MAIC (bottom).

However, MOOCs worldwide face a critical and persistent challenge: extremely high dropout rates Feng et al. (2019). Dropouts in MOOCs refer to learners not completing the full sequence of instructional videos or course activities, similar to physical absence in traditional classrooms, as shown in Figure 1. Despite various efforts to reduce dropout rates, the passive, video-based learning approach of MOOCs makes it difficult to maintain learners’ attention and offer interactions as engaging as those in traditional classrooms Hew and Cheung (2014).

Interactive online learning environments Alsafari et al. (2024); Tan et al. (2025), represented by Massive AI-empowered Courses (MAIC) Yu et al. (2024), use LLM-driven multi-agent systems to transform passive MOOCs into dynamic, interactive learning experiences. Unlike traditional MOOCs with passive video consumption, MAIC enables interactive, text-based learning through conversations with LLM agents guided by instructional slides Zhang-Li et al. (2024). This new paradigm of online interaction compels learners to actively engage with course content and maintain continuous interaction throughout the learning processZhang et al. (2024).

However, it remains uncertain whether previous research conclusions on dropouts in MOOCs can be directly transferred to MAIC. How to define dropouts and the following key research questions need to be answered in MAIC:

RQ 1: What might lead to dropouts?

RQ 2: Can we predict dropouts?

RQ 3: Can we reduce dropouts?

To address these questions, we conducted an empirical study on a specific MAIC course, Towards Artificial General Intelligence, which focuses on AI development and language models across six well-structured chapters. We collect detailed log data from course interactions and perform an exploratory analysis to define and identify dropouts and their contributing factors. Our preliminary findings reveals that dropouts in MAIC are strongly associated with textual interaction patterns between learners and AI agents. Building on this insight, we formally define the dropout prediction task in MAIC and propose a Course-Progress-Adaptive Dropouts Prediction (CPADP) framework, to predict dropouts. Based on the analysis and prediction, we further design a personalized email recall agent that generates unique, tailored emails for each student based on their individual interaction records, aiming to re-engage students at risk of dropping out and rekindle their interest in the course to encourage continued learning.

The prediction and intervention system is implemented in the real-world applied MAIC system. Tests on the dataset constructed on the MAIC-TAGI course shows that the CPADP framework has a theoretical accuracy of at most 95.4%. The feasibility of the personalized Email intervention approach are also validated in this course in a new semester.

2Related Works
2.1Dropouts in Traditional Online Courses

Dropouts in traditional online courses, represented by MOOCs, have been a long-standing challenge, with reports showing the dropout rates in MOOCs worldwide reached over 95% Feng et al. (2019).

Understanding why learners drop out of MOOCs is critical for addressing the issue Huang et al. (2023). The work in Coffrin et al. (2014) analyzes student activity and success patterns. The study in Glance et al. (2014) examines the duration of the course and the number of activities. Other works investigats the role of course design Ferguson and Clow (2015) and learner demographics El Said (2017). These studies provide a foundation for understanding dropout behaviors comprehensively.

Predicting dropouts in MOOCs is extensively studied. Some models focus on predicting dropout risks even before enrollment Li et al. (2023). Others leverage deep neural networks to predict dropout probabilities Imran et al. (2019). Additionally, supervised learning has been applied to detect potential dropouts in the early stages of learning Panagiotakopoulos et al. (2021).

Intervention strategies aim to re-engage learners and reduce dropout rates in MOOCs. Personalization is a key approach Assami et al. (2018). Additionally, fostering social learning and interaction is shown to increase completion rates Crane and Comley (2021). Providing motivational support also plays a crucial role in recalling students Hew and Cheung (2014).

2.2Dropouts in LLM-driven Interactive Online Courses

LLMs have emerged as powerful tools in educational applications, reshaping the landscape of online and interactive learning Alsafari et al. (2024); Rashid et al. (2024); Bui et al. (2024); Tan et al. (2025); Lan and Chen (2024). Recent advancements have demonstrated the potential of AI lecturers to simulate realistic classroom interactions, foster active engagement, and drive innovation in teaching practices Pang et al. (2024); Salminen et al. (2024); Zhang et al. (2024).

Building upon recent advancements, LLM-driven interactive online courses, represented by Massive AI-empowered Courses (MAIC) redefine traditional MOOCs by creating interactive, text-based learning environments facilitated by LLM-driven multi-agent systems Yu et al. (2024). MAIC organizes learning around slides and lecture notes Zhang-Li et al. (2024), with each slide serving as a unit of interaction, illustrated in Figure 8. Learners engage in dynamic conversations with various agents, including an AI Teacher, AI Teaching Assistants (TAs), and simulated peers, creating a collaborative and immersive in-class experience Zhang et al. (2024).

Similar to traditional online courses, dropout issues in these new types of online courses also deserve attention and investigation.

Figure 2:Workflow of dropout analyzing, predicting, and interventing in MAIC.
3MAIC Dropout Analysis

To investigate dropouts in MAIC, we start with the data from a specific course, Towards Artificial General Intelligence (TAGI). We define the dropouts in MAIC according to this data and analysis the relationships between the collected student’s data and their dropout results.

3.1Data Source

TAGI is a highly acclaimed in-person course offered at a top university in China. Following the proposal of the MAIC model, with the collaboration of the course instructor, TAGI has been redesigned into an MAIC course, MAIC-TAGI. MAIC-TAGI is divided into six major chapters to cover the history, present, and future directions of AI technology. Currently, MAIC-TAGI has been offered for two semesters, with 186 students from various majors and grades participating in the course in the first semester, and ongoing with different students in the second semester. These students’ basic and trait information, and interaction logs at MAIC course support our subsequent research on dropouts.

3.2Correlation Analysis

RQ 1: What might lead to dropouts?

Definition 1 (Chapter Study Complete).

Let 
𝐶
 be the set of all chapters in a MAIC course. A chapter 
𝑐
∈
𝐶
 is considered “Study Complete” if and only if the teacher Agent has presented all the slides and lecture notes for 
𝑐
. We denote the set of chapters that a student has completed as 
𝑆
⊆
𝐶
.

Definition 2 (Course Completion Progress).

Let 
|
𝐶
|
 be the total number of chapters in a MAIC course. The Course Completion Progress 
𝑃
 of a student is defined as the cardinality of the set 
𝑆
, i.e., 
𝑃
=
|
𝑆
|
.

Definition 3 (Dropouts in MAIC).

A student is considered to have dropped out if 
𝑆
≠
𝐶
, i.e., not all chapters are marked as complete.

We collect and analyze the Course Completion Progress in MAIC-TAGI, as shown in Table 1. We analyze the correlation between the Course Completion Progress and the students’ information. This information includes three categories: basic information, trait information, and interaction logs.

Chapter	0	1	2	3	4	5	6
Students	34	22	8	3	7	2	110
Table 1:Number of students completing each chapter in MAIC-TAGI. 76 students dropped out (40.9%).

Basic Information: Figure 3 visualizes the correlation between students’ college, major, gender, grade, and Course Completion Progress. A chi-square test examines the relationship among these qualitative variables. The results indicate no significant correlation.

Figure 3:The Chi-square results between students’ basic information and Course Completion Progress, indicating no significant correlation.

Trait Information: At the start of each student’s enrollment in the MAIC-TAGI course, they completed a questionnaire designed based on educational theories to assess their traits. This questionnaire measures five indicators: Learning Motivation (LM), Academic Self-Efficacy (ASE), Persistence (LP), Strategy (SR), and Large Model Usage Frequency (LLMF). Students rate themselves on a scale of 1 to 5 for each indicator. A Pearson correlation analysis examines the relationship between these indicators and Course Completion Progress, with the results visualized in Figure 4. The analysis shows that the correlation between these traits and Course Completion Progress is low.

Figure 4:The Pearson results between students’ trait information and Course Completion Progress, indicating low correlation.

Interaction Logs: MAIC-TAGI collects all interaction records between students and the LLM-Agent in the classroom. Figure 5 visualizes the characteristics of students with different Course Completion Progress based on the average number of interactions per chapter and the average length of each interaction. In this coordinate system, points in the upper-right corner represent students who interact more actively with the system (both in frequency and length of interactions), while points closer to the origin indicate less proactive engagement (fewer interactions and shorter lengths). A clear trend emerges: students with higher completion rates (darker points) tend to exhibit more frequent and longer interactions, as reflected by their greater concentration in the upper-right corner compared to lighter points.

Figure 5:Visualization of the characteristics of the students’ interaction information and Course Completion Progress.

In summary, among the information currently collected by MAIC-TAGI, the most relevant factor to Course Completion Progress is the interaction records of students.

4MAIC Dropout Prediction

RQ 2: Can we predict dropouts?

In MOOCs, dropout prediction aims to determine whether a student is likely to drop out in the near future based on their historical activities, including engagement with videos, forums, assignments, and webpage interactions. Similarly, this section defines the dropout prediction task in MAIC and proposes feasible solutions to address it.

Figure 6:Timeline dropout prediction in MAIC.
4.1Task Formulation

The correlation analysis in Section 3.2 suggests that interaction records are potential factors related to the likelihood of dropout. These interaction records comprise a series of structured strings documenting the textual content of interactions between students and multiple agents in the classroom, arranged chronologically. Accordingly, dropout prediction in MAIC can be defined as a binary classification task based on these structured strings.

Definition 4 (Dropout Prediction in MAIC).

Given a student’s interaction records with MAIC before the start of Chapter 
𝐶
ℎ
 (during the history period), the task is to determine whether the student will drop out from the start of Chapter 
𝐶
ℎ
 to the end of Chapter 
𝐶
𝑝
 (during the prediction period):

	
ℙ
(
	
Dropout
∣
ℐ
𝐶
ℎ
,
𝐶
ℎ
,
𝐶
𝑝
)
,
	
	where	
𝐶
ℎ
∈
[
1
,
Last Chapter
]
,
	
		
𝐶
𝑝
∈
[
𝐶
ℎ
,
Last Chapter
]
.
	

Here, 
ℐ
𝐶
ℎ
 denotes the interaction records before Chapter 
𝐶
ℎ
, 
𝐶
ℎ
 represents the start of the history period, and 
𝐶
𝑝
 represents the end of the prediction period, as illustrated in Figure 6. A more detailed explanation of the valid combinations of 
𝐶
ℎ
 and 
𝐶
𝑝
 is provided in the Appendix D.2.

4.2Dropout Dataset

The interaction records in the MAIC-TAGI course are organized into a dataset by varying the values of 
𝐶
ℎ
 and 
𝐶
𝑝
. The input consists of 
𝐶
ℎ
, 
𝐶
𝑝
, and the interaction records preceding 
𝐶
ℎ
, while the output is a binary label indicating whether a course withdrawal occurred.

In MAIC-TAGI, 
𝐶
ℎ
 ranges from 1 to 6, and 
𝐶
𝑝
 ranges from 
𝐶
ℎ
 to 6. A student’s class record can generate multiple dropout prediction instances by combining different values of 
𝐶
ℎ
 and 
𝐶
𝑝
. Under these constraints, we extracted 1201 dropout prediction instances from the class records of 186 students. Of these, 20% are used as the test set, and the remainder as the training set.

Detailed examples of valid combinations for dropout prediction and the full dataset statistics are provided in Appendix D.

4.3Adaptive Predictor

The dropout prediction task in MAIC is a binary classification task for structured text. To handle different stages of course progress and varying amounts of interaction records, we propose a Course-progress-adaptive Dropout Prediction Framework (CPADP). This framework employs different prediction methods at different stages:

1. Zero-Shot Stage: At the beginning of the course, zero-shot methods with large pre-trained language models (LLMs) assess dropout risk using prior knowledge and basic understanding of interaction data.

2. Few-Shot Stage: As records accumulate, labeled examples are incorporated, and prompt engineering is applied to enhance LLM performance.

3. Fine-Tuning Stage: With sufficient data, smaller pre-trained language models (PLMs) are fine-tuned for binary classification. Features from interaction records 
ℐ
𝐶
ℎ
 are extracted using a PLM, and a Multi-Layer Perceptron (MLP) predicts dropout probabilities. This adaptive framework ensures accurate predictions while maintaining computational efficiency across multiple courses.

4.4Prediction Performance

We evaluate prediction performance using F1 Score and Accuracy. Table 2 summarizes results averaged over 3 tests with different random seeds. GPT-4 with Few-shot inference achieves the best performance among LLMs, while PLM fine-tuning surpasses all LLM methods. The best-performing prompt is shown in Figure 11. Appendix E.1 provides a comparison of the inference results among different prompt designs.

Method	Setting	Precision	Recall	F1_score	Accuracy
GPT-4	ZS	0.909	0.250	0.392	0.716
FS	0.921	0.450	0.604	0.779
GLM-4	ZS	0.897	0.231	0.366	0.704
FS	0.812	0.400	0.536	0.742
DeepSeek	ZS	0.897	0.231	0.366	0.704
FS	0.562	0.430	0.487	0.662
PLM	FT	0.966	0.906	0.935	0.954
Table 2:Dropout predictors result. ZS indicates Zero Shot, FS indicates Few Shots, FT indicates Fine Tuning.

While the PLM method performs well, it requires substantial training data. For new courses with limited interaction records and unlabeled data, predictions rely on zero-shot or few-shot settings. CPADP dynamically adapts as the course progresses, improving over time. Once sufficient data is available, PLMs can be consistently used, including across semesters of the same course.

5MAIC Dropout Intervention

RQ 3: Can we reduce dropouts?

The prediction of dropouts aims to identify at-risk dropping-out students. For these students, drawing inspiration from products like Duolingo 1 and Character.AI 2, which leverage personalized notifications to re-engage users, we utilized these students’ interaction records to generate personalized reminder Emails using LLM, helping them recall engaging class content and reignite their interest in returning. This approach establishes a complete “prediction-recognition-intervention" loop based on student interaction data in MAIC.

5.1Generating Personalized Emails

By creating an Email agent using the prompt in Figure 11, we generate engaging, personalized content that not only recalls past learning moments but also uses humor, inspiration, or a conversational tone to re-engage students.

For example, as shown in Figure 7, if a student named “Fred" was confused about the concept of “Hallucination", the Email might reference the earlier session on “General Artificial Intelligence Overview" and preview upcoming contents according to the interaction logs and the topic which Fred may be interested in.

Figure 7:An example of personalized Email generation.
5.2Intervention Results

On January 10, the 65th day in the middle of the new semester in the MAIC-TAGI course, we predict students’ dropout probabilities using a setting where both 
𝐶
ℎ
 and 
𝐶
𝑝
 are the chapters they are currently studying. Based on the prediction results, we generate and send personalized emails to the at-risk students.

We compare the number of logins before and after the intervention: 14 logins during Days 63–65 versus 25 logins during Days 66–68, demonstrating a clear increase in student login frequency and engagement as a direct result of our intervention.

To confirm that the increase is primarily driven by our intervention, we analyze the 17 students who log in during Days 66–68. Specifically, we assess whether the intervention prompts students who would otherwise not log in to engage with the course, ruling out other factors such as increased availability over the weekend. These students are divided into two groups: 9 self-initiated (non-intervened) and 8 recalled (intervened).

Group (headcount)	
Offline Days
	
Chapter
	
Msg Num
	
Msg Length

Self-initiated (9)	
7.66
	
2.56
	
8.78
	
106.56

Recalled (8)	
52.6
	
0.75
	
0.25
	
0.75
Table 3:Comparison of students’ activities by intervention status. Chapter represents the average course chapter progress, Msg Num indicates the average number of messages sent, and Msg Length refers to the average number of words per message.

Table 3 shows that the recalled group has significantly higher offline days (52.6 days on average) and minimal engagement before the intervention, with chapter progress of 0.75 and very few posts (both in number and length). In contrast, the self-initiated group has much fewer offline days (7.66 days on average), higher chapter progress (2.56), and more active participation. These results indicate that our predictions and interventions precisely recalled students who were not actively engaged in interactions, contributing to the observed increase in logins and learning activity.

6Conclusion

This paper studies dropouts in Massive AI-empowered Courses (MAIC) through an empirical examination on the MAIC-TAGI course. We propose the CPADP framework and a personalized email system to predict and recall at-risk students. Our discovery highlights the effectiveness of combining interaction data, adaptive prediction models, and personalized interventions to handle dropouts in LLM-driven online learning environments.

7Limitations

As this paper represents an initial exploration into dropout analysis in a novel AI-driven online course setting, several limitations remain in our methods and findings.

Course Diversity: The dropout analysis, prediction, and email recall validation in this work were conducted using data from a single MAIC course, Towards Artificial General Intelligence (TAGI), offered at a top university in China. Due to the complexity of data collection and analysis processes, the study lacks diversity in terms of the courses used for evaluation. Future work should expand the scope to include more MAIC courses across different subjects, difficulty levels, and institutions to ensure the generalizability of the proposed methods.

Experimental Completeness: The evaluation of the personalized email recall system is relatively limited in scope. Future studies will design more comprehensive, diverse, and robust experiments. This could include A/B testing with larger student populations, varying email designs, and longer-term tracking of re-engagement effects.

8Ethical Considerations

Data Privacy and Informed Consent All interaction data is anonymized to safeguard participant privacy and confidentiality. Participants are fully informed about the study’s purpose, the use of AI-generated content, and the data collection process. Informed consent is obtained, ensuring participants understand their rights and can withdraw at any time.

Accuracy of AI-Generated Content LLM-based educational systems, like the one in this study, may occasionally generate incorrect or misleading information. Despite carefully designed content and agent responses, these risks cannot be fully eliminated. To mitigate potential issues, we actively monitor AI outputs and provide corrections or clarifications to students when inaccuracies arise.

Ethical Deployment of LLM Systems The deployment of LLM-powered systems in education requires thoughtful consideration of their impacts. This study is conducted in a controlled academic setting, and its findings are not applied to broader real-world contexts without further validation. Future work will emphasize additional safeguards and thorough evaluations to ensure these systems are both ethical and effective in diverse scenarios.

References
Alsafari et al. (2024)
↑
Bashaer Alsafari, Eric Atwell, Aisha Walker, and Martin Callaghan. 2024.Towards effective teaching assistants: From intent-based chatbots to llm-powered teaching assistants.Natural Language Processing Journal, 8:100101.
Anders (2015)
↑
Abram Anders. 2015.Theories and applications of massive online open courses (moocs): The case for hybrid design.The International Review of Research in Open and Distributed Learning, 16(6).
Assami et al. (2018)
↑
Sara Assami, Najima Daoudi, and Rachida Ajhoun. 2018.Personalization criteria for enhancing learner engagement in mooc platforms.In 2018 IEEE Global Engineering Education Conference (EDUCON), pages 1265–1272. IEEE.
Baturay (2015)
↑
Meltem Huri Baturay. 2015.An overview of the world of moocs.Procedia-Social and Behavioral Sciences, 174:427–433.
Bui et al. (2024)
↑
Tuan Bui, Oanh Tran, Phuong Nguyen, Bao Ho, Long Nguyen, Thang Bui, and Tho Quan. 2024.Cross-data knowledge graph construction for llm-enabled educational question-answering system: a case study at hcmut.In Proceedings of the 1st ACM Workshop on AI-Powered Q&A Systems for Multimedia, pages 36–43.
Coffrin et al. (2014)
↑
Carleton Coffrin, Linda Corrin, Paula De Barba, and Gregor Kennedy. 2014.Visualizing patterns of student engagement and performance in moocs.In Proceedings of the fourth international conference on learning analytics and knowledge, pages 83–92.
Crane and Comley (2021)
↑
Rich A Crane and Steph Comley. 2021.Influence of social learning on the completion rate of massive online open courses.Education and Information Technologies, 26(2):2285–2293.
El Said (2017)
↑
Ghada Refaat El Said. 2017.Understanding how learners use massive open online courses and why they drop out: Thematic analysis of an interview study in a developing country.Journal of Educational Computing Research, 55(5):724–752.
Feng et al. (2019)
↑
Wenzheng Feng, Jie Tang, and Tracy Xiao Liu. 2019.Understanding dropouts in moocs.In Proceedings of the AAAI conference on artificial intelligence, volume 33, pages 517–524.
Ferguson and Clow (2015)
↑
Rebecca Ferguson and Doug Clow. 2015.Examining engagement: analysing learner subpopulations in massive open online courses (moocs).In Proceedings of the fifth international conference on learning analytics and knowledge, pages 51–58.
Glance et al. (2014)
↑
David G Glance, P Hugh R Barrett, and R Hugh. 2014.Attrition patterns amongst participant groups in massive open online courses.In ASCILITE Conference, Dunedin, New Zealand. Retrieved from http://ascilite2014. otago. ac. nz/files/fullpapers/16-Glance. pdf.
Hew and Cheung (2014)
↑
Khe Foon Hew and Wing Sum Cheung. 2014.Students’ and instructors’ use of massive open online courses (moocs): Motivations and challenges.Educational research review, 12:45–58.
Huang et al. (2023)
↑
Hao Huang, Lihjen Jew, and Dandan Qi. 2023.Take a mooc and then drop: A systematic review of mooc engagement pattern and dropout factor.Heliyon, 9(4).
Imran et al. (2019)
↑
Ali Shariq Imran, Fisnik Dalipi, and Zenun Kastrati. 2019.Predicting student dropout in a mooc: An evaluation of a deep neural network model.In Proceedings of the 2019 5th International Conference on Computing and Artificial Intelligence, pages 190–195.
Lan and Chen (2024)
↑
Yu-Ju Lan and Nian-Shing Chen. 2024.Teachers’ agency in the era of llm and generative ai.Educational Technology & Society, 27(1):I–XVIII.
Li et al. (2023)
↑
Jin Li, Shu Li, Yuan Zhao, Longjiang Guo, Fei Hao, Meirui Ren, and Keqin Li. 2023.Predicting dropouts before enrollments in moocs: an explainable and self-supervised model.IEEE Transactions on Services Computing, 16(6):4154–4167.
Panagiotakopoulos et al. (2021)
↑
Theodor Panagiotakopoulos, Sotiris Kotsiantis, Georgios Kostopoulos, Omiros Iatrellis, and Achilles Kameas. 2021.Early dropout prediction in moocs through supervised learning and hyperparameter optimization.Electronics, 10(14):1701.
Pang et al. (2024)
↑
Ching Christie Pang, Yawei Zhao, Zhizhuo Yin, Jia Sun, Reza Hadi Mogavi, and Pan Hui. 2024.Artificial human lecturers: Initial findings from asia’s first ai lecturers in class to promote innovation in education.arXiv preprint arXiv:2410.03525.
Rashid et al. (2024)
↑
Md Mamunur Rashid, Nilsu Atilgan, Jonathan Dobres, Stephanie Day, Veronika Penkova, Mert Küçük, Steven R Clapp, and Ben D Sawyer. 2024.Humanizing ai in education: A readability comparison of llm and human-created educational content.In Proceedings of the Human Factors and Ergonomics Society Annual Meeting, volume 68, pages 596–603. SAGE Publications Sage CA: Los Angeles, CA.
Salminen et al. (2024)
↑
Joni Salminen, Soon-gyo Jung, Johanne Medina, Kholoud Aldous, Jinan Azem, Waleed Akhtar, and Bernard J Jansen. 2024.Using cipherbot: An exploratory analysis of student interaction with an llm-based educational chatbot.In Proceedings of the Eleventh ACM Conference on Learning@ Scale, pages 279–283.
Tan et al. (2025)
↑
Kehui Tan, Jiayang Yao, tianqi pang, Chenyou Fan, and Yu Song. 2025.Elf: Educational llm framework of improving and evaluating ai generated content for classroom teaching.ACM Journal of Data and Information Quality.
Yu et al. (2024)
↑
Jifan Yu, Zheyuan Zhang, Daniel Zhang-li, Shangqing Tu, Zhanxin Hao, Rui Miao Li, Haoxuan Li, Yuanchun Wang, Hanming Li, Linlu Gong, Jie Cao, Jiayin Lin, Jinchang Zhou, Fei Qin, Haohua Wang, Jianxiao Jiang, Lijun Deng, Yisi Zhan, Chaojun Xiao, Xusheng Dai, Xuan Yan, Nianyi Lin, Nan Zhang, Ruixin Ni, Yang Dang, Lei Hou, Yu Zhang, Xu Han, Manli Li, Juanzi Li, Zhiyuan Liu, Huiqin Liu, and Maosong Sun. 2024.From mooc to maic: Reshaping online teaching and learning through llm-driven agents.Preprint, arXiv:2409.03512.
Zhang et al. (2024)
↑
Zheyuan Zhang, Daniel Zhang-Li, Jifan Yu, Linlu Gong, Jinchang Zhou, Zhanxin Hao, Jianxiao Jiang, Jie Cao, Huiqin Liu, Zhiyuan Liu, et al. 2024.Simulating classroom education with llm-empowered agents.arXiv preprint arXiv:2406.19226.
Zhang-Li et al. (2024)
↑
Daniel Zhang-Li, Zheyuan Zhang, Jifan Yu, Joy Lim Jia Yin, Shangqing Tu, Linlu Gong, Haohua Wang, Zhiyuan Liu, Huiqin Liu, Lei Hou, et al. 2024.Awaking the slides: A tuning-free and knowledge-regulated ai tutoring system via language model coordination.arXiv preprint arXiv:2409.07372.
Figure 8:A schematic diagram of the learning environment in MAIC.
Appendix AThe Deployed MAIC System

As mentioned in the paper, the MAIC system has been deployed for over one year, supporting dozens of courses, across more than 3,000 students. Due to the double-blind review requirement, we are unable to provide further details about the deployed system at this time.

Appendix BLearning Modes in the MAIC Course

In the MAIC classroom, students engage in a highly personalized and interactive learning environment, as depicted in Figure 8. Students interact with different types of AI agents: AI teachers, AI teaching assistants, and other customizable AI classmates. These agents collaboratively create a dynamic and personalized learning experience that adapts to individual student needs.

Appendix CCase Study of Interaction Logs

In the MAIC classroom, students’ interaction logs are closely related to their class participation, and the probability of dropping out. To illustrate this relationship, a case is constructed, as shown in Figure 10. In this case, Fred’s irrelevant interactions resulted in a high dropout probability, with a predicted likelihood of 52% for the subsequent chapter. In contrast, Alice’s highly relevant interactions, indicating active engagement in the class, yielded a much lower dropout probability of only 2%. Notably, the actual outcomes aligned with these predictions: Fred dropped out in the next chapter, while Alice remained enrolled.

Appendix DDetails of the Dropout Dataset

In MAIC-TAGI, the dropout dataset is constructed by varying the values of 
𝐶
ℎ
 and 
𝐶
𝑝
 for each student’s interaction records. The input consists of 
𝐶
ℎ
, 
𝐶
𝑝
, and the interaction records preceding 
𝐶
ℎ
, while the output is a binary label indicating whether a course withdrawal occurred.

D.1Dataset Statistics

Table 4 provides detailed statistics of the dropout dataset. A total of 1201 dropout prediction instances were generated from the class records of 198 students, with 20% used as the test set and the remaining 80% as the training set.

	
𝐶
𝑝

		1	2	3	4	5	6

𝐶
ℎ
	1	186	22	8	3	7	2
2	0	186	8	3	7	2
3	0	0	186	3	7	2
4	0	0	0	186	7	2
5	0	0	0	0	186	2
6	0	0	0	0	0	186
Table 4:Scale of MAIC-TAGI dropouts prediction dataset.
	
𝐶
𝑝

		1	2	3	4	5	6

𝐶
ℎ
	1	
×
		
✓
			
2		
×
	
✓
			
3			
✓
			
4				
✓
		
5					
✓
	
6						
✓
Table 5:Dropouts instances from a specific student who drops out at Chapter 3. The 
✓
 marks the label as True, while the 
×
 marks the label as False.
D.2Valid Combinations of 
𝐶
ℎ
 and 
𝐶
𝑝

It is noteworthy that 
𝐶
ℎ
 cannot be zero because prediction is meaningless when there are no records. The value of 
𝐶
𝑝
 can also equal 
𝐶
ℎ
, meaning that all historical interaction data before the start of this chapter is used to predict whether the student will drop out by the end of the same chapter.

For example, if a student drops out during Chapter 3, the valid combinations of 
𝐶
ℎ
 and 
𝐶
𝑝
 are:

	
(
1
,
1
)
,
(
1
,
3
)
,
(
2
,
2
)
,
(
2
,
3
)
,
(
3
,
3
)
,
(
4
,
4
)
,
(
5
,
5
)
,
(
6
,
6
)
.
	

Table 5 shows the instances generated from this case. The 
✓
 marks the label as True, which means this student drops out.

D.3Case-aware Prediction Accuracy

Section 4 presents the overall prediction accuracy of our proposed CPADP framework. Figure 9 provides a detailed visualization of the case-level accuracy across the entire dataset.

It can be observed that the prediction accuracy decreases as the difference 
𝐶
𝑝
−
𝐶
ℎ
 increases from the results. This trend suggests that the larger the gap between the student’s current progress and their historical record, the more challenging it becomes to make accurate predictions.

Therefore, when applying dropout prediction in practical classroom settings, the optimal configuration is to base predictions on the student’s current chapter (
𝐶
𝑝
) and their performance in previous chapters (
𝐶
ℎ
). This approach ensures a more accurate assessment of whether the student is likely to complete the current chapter.

Figure 9:Case accuracy details heatmap. “HistoryStamp” corresponds to 
𝐶
ℎ
, and “EndStamp” corresponds to 
𝐶
𝑝
.
Figure 10:Case Study (A pseudonym is used, but the case is real)
Figure 11:Prompts used in prediction and Email generation.
Appendix EDetails of Dropout Prediction
E.1Prompt Designs

Table 6 lists the accuracy of GPT-4 under zero-shot settings and four different few-shot settings. The results show that including diverse examples, such as special cases and causal examples, significantly improves performance.

Prompt Design	Accuracy
Zero-shot	0.716
Random Selecting Examples	0.730
Only False Examples	0.745
Two Special Case Examples	0.760
Special Case Examples and Casual Examples	0.779
Table 6:Dropout predictors accuracy of GPT-4 under different prompt settings.
E.2PLM Structure

To predict dropout probabilities, the interaction records 
ℐ
𝐶
ℎ
 are first processed through a pre-trained language model (PLM) to extract features. The resulting features are then passed into a Multi-Layer Perceptron (MLP) for binary classification. The process can be formally described as follows:

	
𝐡
	
=
PLM
​
(
ℐ
𝐶
ℎ
)
,
	
	
ℙ
​
(
Dropout
)
,
	
ℙ
​
(
Retention
)
=
MLP
​
(
𝐡
)
.
	

Here, 
𝐡
 represents the feature vector generated by the PLM, while 
ℙ
​
(
Dropout
)
 and 
ℙ
​
(
Retention
)
 are the predicted probabilities of dropout and retention, respectively.

Report Issue
Report Issue for Selection
Generated by L A T E xml 
Instructions for reporting errors

We are continuing to improve HTML versions of papers, and your feedback helps enhance accessibility and mobile support. To report errors in the HTML that will help us improve conversion and rendering, choose any of the methods listed below:

Click the "Report Issue" button.
Open a report feedback form via keyboard, use "Ctrl + ?".
Make a text selection and click the "Report Issue for Selection" button near your cursor.
You can use Alt+Y to toggle on and Alt+Shift+Y to toggle off accessible reporting links at each section.

Our team has already identified the following issues. We appreciate your time reviewing and reporting rendering errors we may not have found yet. Your efforts will help us improve the HTML versions for all readers, because disability should not be a barrier to accessing research. Thank you for your continued support in championing open access for all.

Have a free development cycle? Help support accessibility at arXiv! Our collaborators at LaTeXML maintain a list of packages that need conversion, and welcome developer contributions.
```
